import { DurableObject } from "cloudflare:workers";
import { canon, forListener, hearPacket, sentPacket } from "./translate.js";

export class TalkRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sessions = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment) this.sessions.set(ws, attachment);
    }
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const url = new URL(request.url);
    let lang = "en";
    try {
      lang = canon(url.searchParams.get("lang") || "en");
    } catch {
      return Response.json({ error: "unsupported language" }, { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const session = { id: crypto.randomUUID(), lang };
    server.serializeAttachment(session);
    this.sessions.set(server, session);
    server.send(JSON.stringify({ type: "joined", id: session.id, lang }));
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

    if (data.type === "lang") {
      try {
        session.lang = canon(data.lang);
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "unsupported language" }));
        return;
      }
      ws.serializeAttachment(session);
      this.sessions.set(ws, session);
      ws.send(JSON.stringify({ type: "lang", lang: session.lang }));
      return;
    }

    if (data.type !== "say") return;
    const text = String(data.text || "").trim().slice(0, 500);
    if (!text) return;

    const id = crypto.randomUUID();
    ws.send(JSON.stringify(sentPacket(id)));

    const byLang = new Map();
    for (const [peerWs, peer] of this.sessions) {
      if (peerWs === ws || peerWs.readyState !== 1) continue;
      const list = byLang.get(peer.lang) || [];
      list.push(peerWs);
      byLang.set(peer.lang, list);
    }

    for (const [lang, sockets] of byLang) {
      try {
        const translated = await forListener(this.env.AI, text, session.lang, lang);
        const packet = JSON.stringify(hearPacket(translated.forListener, lang));
        for (const peerWs of sockets) peerWs.send(packet);
      } catch {
        ws.send(JSON.stringify({ type: "missed", id }));
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    this.sessions.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }
}
