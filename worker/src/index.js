import { LANGUAGES, forListener } from "./translate.js";
import { TalkRoom } from "./room.js";

export { TalkRoom };

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type"
        }
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/v1/languages" && request.method === "GET") {
      return json({ middle: "en", languages: LANGUAGES });
    }

    if (url.pathname === "/v1/translate" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad json" }, 400);
      }
      try {
        const result = await forListener(env.AI, body.text, body.from, body.to, {
          debug: url.searchParams.get("debug") === "1"
        });
        return json(result);
      } catch (err) {
        const status = err.status || 502;
        return json({ error: err.message || "translation failed" }, status);
      }
    }

    const talk = url.pathname.match(/^\/v1\/talk\/([a-z0-9-]{1,48})$/);
    if (talk) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return json({ error: "Expected websocket" }, 426);
      }
      const stub = env.TALK.getByName(talk[1]);
      return stub.fetch(request);
    }

    if (url.pathname === "/talk") {
      return Response.redirect(new URL("/talk.html", url).toString(), 302);
    }

    return env.ASSETS.fetch(request);
  }
};
