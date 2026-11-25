# Dream Junkies

Chronicle cinema, the Dream Lane, and BridgeTalk.

The cinema plays the published manga from dreamjunkies.site. Captains are the generation characters for a Stick Wars: Legacy retelling.

World and biome law is not this repository. That catalog lives in ObjectStore (`F:\GitHub\ObjectStore`), on `info.grudge-studio.com` and `objectstore.grudge-studio.com`.

## About

GitHub About for [MolochDaGod/dream-junkies](https://github.com/MolochDaGod/dream-junkies):

| Field | Value |
| --- | --- |
| Description | Chronicle cinema, Dream Lane, and BridgeTalk. Live on the dream-junkies-talk worker. |
| Website | https://dream-junkies-talk.grudge.workers.dev/ |
| Topics | `dream-junkies`, `cloudflare-workers`, `threejs` |
| Visibility | Public. `main` is the default branch. |

The website field is the worker root, which is the cinema. Dream Lane is `/play`. BridgeTalk is `/talk`.

## Deployment

Production is Cloudflare Worker `dream-junkies-talk`, account Grudge. Config is `worker/wrangler.jsonc`. There is no custom domain on that config. The workers.dev host is the live site.

| URL | What it is |
| --- | --- |
| https://dream-junkies-talk.grudge.workers.dev/ | Chronicle cinema |
| https://dream-junkies-talk.grudge.workers.dev/play | Dream Lane |
| https://dream-junkies-talk.grudge.workers.dev/talk | BridgeTalk |
| https://dream-junkies-talk.grudge.workers.dev/v1/captains | Army book |

Checked 2026-11-24: those four URLs returned 200. `/`, `/play`, and `/talk` are HTML. `/v1/captains` and `/v1/languages` are JSON.

The asset directory is `cinema/`. `run_worker_first` is only `/v1/*`, so pages and voice files come from the asset binding and the API is the Worker. Talk rooms and the lexicon are Durable Objects `TalkRoom` (migration `v1`) and `Lexicon` (migration `v2`). Workers AI is binding `AI`. There is no API key in the repo.

Deploy from `worker/` with Wrangler 4, when a deploy is intended:

```text
wrangler deploy
```

`npm run dev` in the repo root previews the lane with Vite on `http://127.0.0.1:5179/cinema/play.html`. That static preview has no Worker, so `/v1/captains` 404s and the lane reads `/data/captains.json`. `npm test` runs `cinema/play-sim.test.mjs` and `worker/src/wire.test.mjs`.

GitHub Deployments is a record of that worker, environment `production`, site `https://dream-junkies-talk.grudge.workers.dev/`. Wrangler does not write that record by itself.

## GitHub Pages

GitHub Pages is off. `GET /repos/MolochDaGod/dream-junkies/pages` returns 404, and `has_pages` is false. Leave it off.

Pages would publish files from the repository and would not run this Worker. `/v1/*`, the talk room, the lexicon, and Workers AI would be missing, while `/` and `/play` would look like the product. The cinema, the lane, and BridgeTalk stay on one host: the worker above.

A local preview is `npm run dev`. It is not a second public site.

## Chronicle voice

The four opening films have no audio stream. The player speaks `cinema/voice/open-0.mp3` through `open-3.mp3` over them. Those lines are the on-screen captions. The third line also keeps the published bloodline sentence. Plate narration is `cinema/voice/pXX-Y.mp3`, taken from the published clips and spelled with the chronicle names. The speaker is Workers AI `@cf/deepgram/aura-1`, voice `zeus`. A short line does not cut the picture. If the browser blocks autoplay, the control reads Hear it.

`motion.narration` is still the old Base44 file. The cinema does not play it. Prose founders stay twenty-seven loyal souls. The entrance caption stays twenty-nine loyal companions.

`/favicon.ico` is the icon for the cinema, Dream Lane, and BridgeTalk.

## Dream Lane

`/play` is the lane. One statue is the captain you hold, from `data/captains.json`. The far statue is Tengu Legends, unless you hold Tengu, in which case it is Oze. Training spends $DREAM. An upgrade spends Dream Essence, a little $DREAM, and one of that captain's lore items. The tier-5 rite does not summon a body.

This repository is the OhMyGrudge web game. The live lane is `/play` on the worker in Deployment. `GET /v1/captains` is the army book. The camera is the Grudge third-person orbit: click the field to look, WASD walks with the camera, 1–4 train, U upgrades the nearest troop, R is the rite. Captains, both statues, and the four troop roles share one img2threejs body, `cinema/bodies/dream-human.js`, built from `models/dream-human.json`. Chronicle colors and the hand or head props tell them apart. Troops and the captain are 1.8 m. Statues are 2.5 m. If that body fails to build, the lane falls back to the marker figures. They are not a Warlords play body. The worker that is live today still has the markers until the next deploy.

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
