import { DurableObject } from "cloudflare:workers";
import { filterProfanity } from "./glossary.js";
import { loadEntries } from "./lexicon.js";
import { bridgeMessage, canon, ccPacket, hearPacket, MIDDLE, renderFor, sentPacket } from "./translate.js";

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

  /** One render per language and filter. English is the pivot already computed. */
  async caption(bridged, lang, filterOn) {
    const target = lang || MIDDLE;
    if (!bridged.renders) bridged.renders = new Map();
    const key = `${target}:${filterOn ? "1" : "0"}`;
    const hit = bridged.renders.get(key);
    if (hit) return hit;
    let rendered;
    if (target === MIDDLE) {
      rendered = {
        text: filterOn ? filterProfanity(bridged.pivot) : bridged.pivot,
        lang: MIDDLE,
        confidence: bridged.confidence,
        approx: Boolean(bridged.approx),
        trained: Boolean(bridged.trained)
      };
    } else {
      rendered = await renderFor(this.env.AI, bridged, target, { filter: filterOn });
    }
    bridged.renders.set(key, rendered);
    return rendered;
  }

  captionPacket(id, name, ts, bridged, rendered, filterOn) {
    return ccPacket({
      id,
      name,
      text: rendered.text,
      lang: rendered.lang,
      en: filterOn ? filterProfanity(bridged.pivot) : bridged.pivot,
      enApprox: bridged.approx,
      approx: rendered.approx,
      trained: rendered.trained,
      ts
    });
  }

  async replayCc(ws, session) {
    const lang = session.cc || MIDDLE;
    for (const [id, row] of this.recent) {
      if (!row.bridged || ws.readyState !== 1) continue;
      try {
        const rendered = await this.caption(row.bridged, lang, session.filter);
        ws.send(JSON.stringify(this.captionPacket(id, row.name, row.ts, row.bridged, rendered, session.filter)));
      } catch {
        /* This caption did not render. The raw line stays here. */
      }
    }
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const url = new URL(request.url);
    let speak = "ig";
    let hear = "ig";
    let cc = MIDDLE;
    try {
      speak = canon(url.searchParams.get("speak") || url.searchParams.get("lang") || "ig");
      hear = canon(url.searchParams.get("hear") || url.searchParams.get("lang") || speak);
    } catch {
      return Response.json({ error: "unsupported language" }, { status: 400 });
    }
    try {
      const asked = url.searchParams.get("cc");
      if (asked) cc = canon(asked);
    } catch {
      cc = MIDDLE;
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
      cc,
      filter: flag(url.searchParams.get("filter")),
      mock: flag(url.searchParams.get("mock"))
    };
    this.save(server, session);
    server.send(JSON.stringify({
      type: "joined",
      id: session.id,
      name: session.name,
      speak: session.speak,
      hear: session.hear,
      cc: session.cc
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
      let speak = session.speak;
      let hear = session.hear;
      let cc = session.cc || MIDDLE;
      try {
        if (data.speak || data.lang) speak = canon(data.speak || data.lang);
        if (data.hear || data.lang) hear = canon(data.hear || data.lang);
        if (data.cc) cc = canon(data.cc);
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "unsupported language" }));
        return;
      }
      const ccChanged = cc !== (session.cc || MIDDLE);
      session.speak = speak;
      session.hear = hear;
      session.cc = cc;
      if (data.name != null) session.name = cleanName(data.name);
      if (data.filter != null) session.filter = flag(data.filter);
      if (data.mock != null) session.mock = flag(data.mock);
      this.save(ws, session);
      ws.send(JSON.stringify({
        type: "setup",
        name: session.name,
        speak: session.speak,
        hear: session.hear,
        cc: session.cc,
        filter: session.filter,
        mock: session.mock
      }));
      this.broadcast(this.roster());
      if (ccChanged) await this.replayCc(ws, session);
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

    const ts = Date.now();
    const pivot = session.filter ? filterProfanity(bridged.pivot) : bridged.pivot;
    this.remember(id, {
      owner: session.id,
      name: session.name,
      ts,
      clean: bridged.clean,
      src: bridged.src,
      pivot: bridged.pivot,
      bridged
    });
    ws.send(JSON.stringify(sentPacket({
      id,
      pivot,
      confidence: bridged.confidence,
      approx: bridged.approx,
      trained: bridged.trained
    })));

    const hearGroups = new Map();
    const ccGroups = new Map();
    for (const [peerWs, peer] of this.sessions) {
      if (peerWs.readyState !== 1) continue;
      const ccLang = peer.cc || MIDDLE;
      const ccKey = `${ccLang}:${peer.filter ? "1" : "0"}`;
      const ccGroup = ccGroups.get(ccKey) || { lang: ccLang, filter: peer.filter, sockets: [] };
      ccGroup.sockets.push(peerWs);
      ccGroups.set(ccKey, ccGroup);
      if (peerWs === ws) continue;
      const hearKey = `${peer.hear}:${peer.filter ? "1" : "0"}`;
      const hearGroup = hearGroups.get(hearKey) || { hear: peer.hear, filter: peer.filter, sockets: [] };
      hearGroup.sockets.push(peerWs);
      hearGroups.set(hearKey, hearGroup);
    }

    let failed = 0;
    for (const group of hearGroups.values()) {
      try {
        const rendered = await this.caption(bridged, group.hear, group.filter);
        const packet = JSON.stringify(hearPacket({
          text: rendered.text,
          lang: rendered.lang,
          confidence: rendered.confidence,
          approx: rendered.approx,
          name: session.name,
          ts,
          id,
          trained: rendered.trained
        }));
        for (const peerWs of group.sockets) peerWs.send(packet);
      } catch {
        failed += 1;
      }
    }
    for (const group of ccGroups.values()) {
      try {
        const rendered = await this.caption(bridged, group.lang, group.filter);
        const packet = JSON.stringify(this.captionPacket(id, session.name, ts, bridged, rendered, group.filter));
        for (const peerWs of group.sockets) peerWs.send(packet);
      } catch {
        /* Caption failed. Nothing raw is sent. */
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
