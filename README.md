# Dream Junkies

Chronicle cinema and live match talk.

The cinema plays the published manga from dreamjunkies.site. Captains are the generation characters for a Stick Wars: Legacy retelling.

## Live talk

Worker `dream-junkies-talk` uses Workers AI `@cf/meta/m2m100-1.2b`.

English is the middle language. It is not delivered to players. A player receives only `hear` in their own language. The sender receives `sent`, never their own translation and never the other player's raw line.

Igbo (`ig`, Nigeria, `ig-NG` on the mic) is a play language. Yoruba and Hausa are on the same list.

- `GET /v1/languages`
- `POST /v1/translate` with `{ "text", "from", "to" }`
- `POST /v1/translate?debug=1` adds `middle` for development
- `GET /v1/talk/:room?lang=ig` WebSocket upgrade

Open `/talk` on the worker host. Two browsers, two languages, one room name.
