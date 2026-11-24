# Dream Junkies

Chronicle cinema and live match talk.

The cinema plays the published manga from dreamjunkies.site. Captains are the generation characters for a Stick Wars: Legacy retelling.

## BridgeTalk

Worker `dream-junkies-talk` uses Workers AI `@cf/meta/m2m100-1.2b`. There is no API key. `.env.example` is empty of secrets on purpose. `?mock=1` skips the model.

English is the middle language. The sender's socket gets `sent.pivot` so they can check meaning. Every other player gets only `hear` in the language they chose. That packet has no source line and no English middle. A failed hop sends nothing raw.

Igbo (`ig`, `ig-NG` on the mic) is the play language. Yoruba, Hausa, French, Spanish, and Portuguese are on the same machine list. Nigerian Pidgin (`pcm`) is config too, but the model has no Pidgin code: callouts are hand-written, and a free sentence falls back through English with `approx: true`.

Hand-written callouts (`gg`, `rush B`, `heal me`, `enemy left`, `push`, `retreat`, `need ammo`) are applied before the model. Quick buttons send the callout id and do not wait on a translation.

The model does not return a confidence score. Machine lines are marked approx. Glossary lines are not.

- `GET /v1/languages`
- `GET /v1/callouts`
- `POST /v1/rooms` returns a 6-character code
- `POST /v1/translate` with `{ "text", "from", "to" }`
- `POST /v1/translate?debug=1` adds `middle` for development
- `POST /v1/translate?mock=1` skips the model
- `GET /v1/talk/:room?speak=ig&hear=en` WebSocket upgrade

Open `/talk` on the worker host. Two browsers, one room code, two languages. The caption overlay stays inside the browser tab. Voice is the browser recognizer plus text. Igbo speech-to-text is weak, so typing and the callout buttons are the reliable path. Audio and lines are not stored.
