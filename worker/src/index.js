import { CALLOUTS, roomCode } from "./glossary.js";
import { LANGUAGES, MIDDLE, forListener } from "./translate.js";
import { TalkRoom } from "./room.js";

export { TalkRoom };
export { roomCode };

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
      return json({ middle: MIDDLE, languages: LANGUAGES });
    }

    if (url.pathname === "/v1/callouts" && request.method === "GET") {
      return json({
        callouts: CALLOUTS.map((callout) => ({ id: callout.id, text: callout.text }))
      });
    }

    if (url.pathname === "/v1/rooms" && request.method === "POST") {
      const code = roomCode();
      return json({ code, path: `/talk?room=${code}` });
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
          debug: url.searchParams.get("debug") === "1",
          mock: url.searchParams.get("mock") === "1" || body.mock === true,
          filter: body.filter === true
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

    return env.ASSETS.fetch(request);
  }
};
