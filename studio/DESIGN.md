# Dream Lane

OhMyGrudge web game for the Dream Junkies world.

Open this repository as a Web Game. `npm run dev` previews `cinema/play.html`. The live copy is the existing worker `dream-junkies-talk`, at `/play`.

## What the match is

Stick Wars: Legacy, one lane. The statue is the generation captain from `data/captains.json`. Season-one enemy is Tengu Legends. If the player holds Tengu, the far statue is Oze.

Train spends $DREAM and unlocks the next troop in that captain's tree. The troop steps onto the lane in front of the captain and marches at the far statue. Upgrade spends Dream Essence, a little $DREAM, and one of that captain's lore items. The tier-5 rite does not spawn a body. It sharpens the troops already on the field.

Miners add $DREAM while they live. The win is the enemy statue at 0.

## What is reused

- Captain book: `data/captains.json`. The worker serves it at `GET /v1/captains`. Local Vite also serves `/data/captains.json`.
- Third person: the orbit in `cinema/play.js` follows Grudge `Controller.ts`. Yaw, positive pitch so the camera stays above the floor, distance 2.5–10, camera-relative WASD, screen-right is `(-forward.z, 0, forward.x)`. It is the camera and the walk. It is not a second combat controller, mixer, or physics world.
- Rules: `cinema/play-sim.js`. Three.js only draws positions. Humans are about 1.8 m. The statue is about 2.5 m. The lane is 36 m.
- Body: one img2threejs rig, `cinema/bodies/dream-human.js`, from `models/dream-human.json`. The lane tints it and hangs the troop prop on the bones. It is not a second mixer or a Warlords play body.

## Controls

Click the field to look. WASD walks. 1–4 train. U upgrades the nearest troop. R is the rite. The buttons on the lane do the same thing.
