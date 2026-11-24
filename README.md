# Dream Junkies

Chronicle cinema and live match talk.

The cinema plays the published manga from dreamjunkies.site. Captains are the generation characters for a Stick Wars: Legacy retelling.

World and biome law is not this repository. That catalog lives in ObjectStore (`F:\GitHub\ObjectStore`), on `info.grudge-studio.com` and `objectstore.grudge-studio.com`.

## Chronicle voice

The four opening films have no audio stream. The player speaks `cinema/voice/open-0.mp3` through `open-3.mp3` over them. Those lines are the on-screen captions. The third line also keeps the published bloodline sentence. Plate narration is `cinema/voice/pXX-Y.mp3`, taken from the published clips and spelled with the chronicle names. The speaker is Workers AI `@cf/deepgram/aura-1`, voice `zeus`. A short line does not cut the picture. If the browser blocks autoplay, the control reads Hear it.

`motion.narration` is still the old Base44 file. The cinema does not play it. Prose founders stay twenty-seven loyal souls. The entrance caption stays twenty-nine loyal companions.

`/favicon.ico` is the icon for the cinema, Dream Lane, and BridgeTalk.

## Dream Lane

`/play` is the lane. One statue is the captain you hold, from `data/captains.json`. The far statue is Tengu Legends, unless you hold Tengu, in which case it is Oze. Training spends $DREAM. An upgrade spends Dream Essence, a little $DREAM, and one of that captain's lore items. The tier-5 rite does not summon a body.

This repository is the OhMyGrudge web game. `npm run dev` previews `cinema/play.html`. The same page is served by worker `dream-junkies-talk`, and `GET /v1/captains` is the army book. The camera is the Grudge third-person orbit: click the field to look, WASD walks with the camera, 1–4 train, U upgrades the nearest troop, R is the rite. The figures are lane markers about 1.8 m tall. They are not a Warlords play body.

## BridgeTalk

Worker `dream-junkies-talk` uses Workers AI `@cf/meta/m2m100-1.2b`. There is no API key. `.env.example` is empty of secrets on purpose. `?mock=1` skips the model.

English is the middle language. The sender's socket gets `sent.pivot` so they can check meaning. Every other player gets only `hear` in the language they chose. That packet has no source line and no English middle. A failed hop sends nothing raw.

Captions are a second track. Every player, including the speaker, sees every line in English. The caption language control rewrites that same track. Hear and the spoken voice stay in the listener's language only. A caption packet has the English line and the chosen caption line. It does not carry the speaker's raw source. The room keeps the last 40 lines in memory so a language change can redraw them. That memory is wiped on hibernation and is not written to disk or to the browser.

Igbo (`ig`, `ig-NG` on the mic) is the play language. Yoruba, Hausa, French, Spanish, and Portuguese are on the same machine list. Nigerian Pidgin (`pcm`) is config too, but the model has no Pidgin code: callouts are hand-written, and a free sentence falls back through English with `approx: true`.

Hand-written callouts (`gg`, `rush B`, `heal me`, `enemy left`, `push`, `retreat`, `need ammo`) are applied before the model, including Spanish and Chinese. Quick buttons send the phrase, so a trained correction of that phrase wins.

Train saves words, jargon, and expressions in the shared lexicon. English stays the middle. A saved line replaces the model for that phrase. Fix English on your own middle. Fix this on a line you heard, which writes your language only and does not reveal the other player's raw words. The lexicon is the only thing stored. Chat and audio are not.

Spanish, Chinese, and the other easy M2M100 languages are on `GET /v1/languages`. Nigerian Pidgin stays glossary-only.

The model does not return a confidence score. Machine lines are marked approx. Glossary and trained lines are not.

- `GET /v1/languages`
- `GET /v1/lexicon`
- `POST /v1/lexicon` with `{ "kind", "pivot", "lines" }`
- `DELETE /v1/lexicon/:id`
- `GET /v1/callouts`
- `POST /v1/rooms` returns a 6-character code
- `POST /v1/translate` with `{ "text", "from", "to" }`
- `POST /v1/translate?debug=1` adds `middle` for development
- `POST /v1/translate?mock=1` skips the model
- `GET /v1/talk/:room?speak=ig&hear=en` WebSocket upgrade

Open `/talk` on the worker host. That page is the chat app: create or join a room, then one thread. Your lines sit on the right. Everyone else's sit on the left, in English until you change Captions. The overlay shows that same track and stays inside the browser tab. Voice is the browser recognizer plus text. Igbo speech-to-text is weak, so typing and the callout buttons are the reliable path. Audio and lines are not stored.
