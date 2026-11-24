import { DurableObject } from "cloudflare:workers";
import { filterProfanity } from "./glossary.js";
import { loadEntries } from "./lexicon.js";
import { bridgeMessage, canon, hearPacket, renderFor, sentPacket } from "./translate.js";

function cleanName(value) {
  const name = String(value || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 24);
  return name || "Player";
}

function flag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export class TalkRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sessions = new Map();
    this.recent = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment) this.sessions.set(ws, attachment);
    }
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  roster() {
    const players = [];
    for (const [ws, session] of this.sessions) {
      if (ws.readyState !== 1) continue;
      players.push({
        id: session.id,
        name: session.name,
        speak: session.speak,
        hear: session.hear
      });
    }
    return { type: "roster", players };
  }

  broadcast(payload) {
    const raw = JSON.stringify(payload);
    for (const [ws] of this.sessions) {
      if (ws.readyState === 1) ws.send(raw);
    }
  }

  save(ws, session) {
    ws.serializeAttachment(session);
    this.sessions.set(ws, session);
  }

  remember(id, row) {
    this.recent.set(id, row);
    while (this.recent.size > 40) {
      const oldest = this.recent.keys().next().value;
      this.recent.delete(oldest);
    }
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const url = new URL(request.url);
    let speak = "ig";
    let hear = "ig";
    try {
      speak = canon(url.searchParams.get("speak") || url.searchParams.get("lang") || "ig");
      hear = canon(url.searchParams.get("hear") || url.searchParams.get("lang") || speak);
    } catch {
      return Response.json({ error: "unsupported language" }, { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const session = {
      id: crypto.randomUUID(),
      name: cleanName(url.searchParams.get("name")),
      speak,
      hear,
      filter: flag(url.searchParams.get("filter")),
      mock: flag(url.searchParams.get("mock"))
    };
    this.save(server, session);
    server.send(JSON.stringify({
      type: "joined",
      id: session.id,
      name: session.name,
      speak: session.speak,
      hear: session.hear
    }));
    this.broadcast(this.roster());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const session = this.sessions.get(ws) || ws.deserializeAttachment();
    if (!session) return;
    let data;
    try {
      const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
      data = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "bad json" }));
      return;
    }

    if (data.type === "setup" || data.type === "lang") {
      try {
        if (data.speak || data.lang) session.speak = canon(data.speak || data.lang);
        if (data.hear || data.lang) session.hear = canon(data.hear || data.lang);
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "unsupported language" }));
        return;
      }
      if (data.name != null) session.name = cleanName(data.name);
      if (data.filter != null) session.filter = flag(data.filter);
      if (data.mock != null) session.mock = flag(data.mock);
      this.save(ws, session);
      ws.send(JSON.stringify({
        type: "setup",
        name: session.name,
        speak: session.speak,
        hear: session.hear,
        filter: session.filter,
        mock: session.mock
      }));
      this.broadcast(this.roster());
      return;
    }

    if (data.type === "correct") {
      const row = this.recent.get(String(data.id || ""));
      if (!row) {
        ws.send(JSON.stringify({ type: "error", error: "That line expired. Add it in Train." }));
        return;
      }
      const lines = { [row.src]: row.clean, en: row.pivot };
      if (session.id === row.owner && String(data.pivot || "").trim()) {
        lines.en = String(data.pivot);
      }
      if (String(data.text || "").trim()) lines[session.hear] = String(data.text);
      try {
        const saved = await this.env.LEXICON.getByName("global").save({
          kind: data.kind || "expression",
          pivot: lines.en,
          lines
        });
        ws.send(JSON.stringify({ type: "trained", id: saved.id, kind: saved.kind }));
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", error: err.message || "could not save" }));
      }
      return;
    }

    if (data.type !== "say" && data.type !== "callout") return;
    const text = String(data.text || "").trim().slice(0, 500);
    const calloutId = data.type === "callout" ? String(data.id || "") : "";
    if (!text && !calloutId) return;

    const id = crypto.randomUUID();
    let bridged;
    try {
      const entries = await loadEntries(this.env);
      bridged = await bridgeMessage(this.env.AI, text, session.speak, {
        mock: session.mock,
        calloutId,
        entries
      });
    } catch {
      ws.send(JSON.stringify({ type: "missed", id }));
      return;
    }

    const pivot = session.filter ? filterProfanity(bridged.pivot) : bridged.pivot;
    this.remember(id, { owner: session.id, clean: bridged.clean, src: bridged.src, pivot: bridged.pivot });
    ws.send(JSON.stringify(sentPacket({
      id,
      pivot,
      confidence: bridged.confidence,
      approx: bridged.approx,
      trained: bridged.trained
    })));

    const groups = new Map();
    for (const [peerWs, peer] of this.sessions) {
      if (peerWs === ws || peerWs.readyState !== 1) continue;
      const key = `${peer.hear}:${peer.filter ? "1" : "0"}`;
      const group = groups.get(key) || { hear: peer.hear, filter: peer.filter, sockets: [] };
      group.sockets.push(peerWs);
      groups.set(key, group);
    }

    let failed = 0;
    for (const group of groups.values()) {
      try {
        const rendered = await renderFor(this.env.AI, bridged, group.hear, { filter: group.filter });
        const packet = JSON.stringify(hearPacket({
          text: rendered.text,
          lang: rendered.lang,
          confidence: rendered.confidence,
          approx: rendered.approx,
          name: session.name,
          ts: Date.now(),
          id,
          trained: rendered.trained
        }));
        for (const peerWs of group.sockets) peerWs.send(packet);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) ws.send(JSON.stringify({ type: "missed", id }));
  }

  async webSocketClose(ws, code, reason) {
    this.sessions.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
    this.broadcast(this.roster());
  }
}
