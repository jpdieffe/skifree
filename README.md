# SkiFree: Chain Reaction

[Play on GitHub Pages](https://jpdieffe.github.io/skifree/)

Two visible skiers share a downhill run, connected by an elastic, lethal chain. Host a two-character room, share its invitation, and your friend joins as the blue skier. The run begins when both players connect. You can also practice with a bot partner, or choose **Solo wrecking ball** to ski alone with a giant chained metal ball. Solo needs no room or connection to another player.

This is a **browser adaptation**, with new simulation and procedural slopes, using the original SkiFree artwork extracted from the supplied Windows game. It does not execute or emulate the original EXE. The supplied archive is preserved unchanged at `assets/ski32-original.zip`. SkiFree and its original artwork are by Chris Pirih: https://ski.ihoc.net/.

## Desktop Yeti Onslaught

Choose **Yeti Onslaught** to share one computer: player one skis with **arrows / WASD**, tucks with Down / S, brakes with Up / W, and jumps with **Space**. Player two aims with the **mouse** and clicks or holds the left button to fire. The opening button requires a mouse-capable device; this mode has no touch controls or online room. The options menu pauses the run.

Ski through numbered crates to permanently unlock and immediately equip weapons. All guns have unlimited ammunition. Press **1-6** to choose an unlocked slot: **1 pistol**, **2 machine gun**, **3 shotgun** (short-range spread), **4 sniper rifle** (pierces a line), **5 rocket launcher** (explodes on a monster or at the aimed distance), **6 plasma rifle** (rapid piercing bolts). The weapon bar shows which guns are ready. Each new run resets the inventory.

Ten stages each contain three waves, mixing regular, cyborg, huge, super and tree monsters. Eliminate the entire wave to earn a five-second supply break. After stage ten, the stages repeat with tougher monsters. Wave size grows to 72, with up to 48 monsters active together. Cyborgs charge, super monsters weave, and tree monsters plant obstacles. The camera stays fixed on the skier at the same scale as solo mode.

When a Yeti catches you in any mode, the original grab, swallow and chewing sprites play before the retry screen appears. Capture state is included in multiplayer snapshots so both players see the same sequence.

## Solo wrecking ball

Choose **Solo wrecking ball** on the opening screen. Steering now adds momentum to the swing. Hold **SWING** on a phone, or **E** on a keyboard, to keep the ball rotating around you. Steer left/right to choose or reverse its direction. Brake to let its momentum carry it ahead; tuck to build speed. The ball stays on the snow while you jump.

- **Ball:** smashes trees, large pines, metal poles, rocks, other skiers, snowboarders, dogs, and the yeti. Direct ball contact does not require a minimum speed.
- **Chain:** hits rocks and characters, including the yeti. It never destroys trees or poles, regardless of speed. Those obstacles snag it until you steer around or hit them with the ball.
- Character hits keep the existing bloody explosions and scoring. The blood toggle still works. Jump ramps remain usable.
- The solo camera stays anchored on the skier, without swing-driven camera movement, changing zoom, or impact shake. Desktop sprites use their original 1:1 pixel size; smaller screens zoom out further to show the full swing and more of the slope. Local movement is interpolated between 60 Hz physics steps rather than displayed at the 20 Hz network update rate.
- The first Yeti arrives at 2,000 m. Killing it continues the run automatically; there is no victory screen or Continue button to interrupt skiing.

The multiplayer rules below still apply to two skiers and bot practice.

## Yeti levels

Solo, bot practice, and online multiplayer all advance through the same encounters. After a kill, the next Yeti appears another 300 m downhill. The HUD shows its name, remaining hits, or the next encounter distance. Surviving a hit briefly stuns the Yeti; repeated contact cannot drain every hit point in one frame. Killing it still produces the bloody explosion (or the blood-toggle alternative).

| Level | Yeti | First-cycle hits | Behavior |
| --- | --- | --- | --- |
| 1 | Regular | 1 | Original pursuit |
| 2 | Cyborg | 2 | Metal body and red visor; locks aim, then charges |
| 3 | Huge | 3 | Much larger body and collision radius; slower pursuit |
| 4 | Super | 3 | Gold body, red cape, faster weaving pursuit |
| 5 | Tree | 4 | Green body and branches; plants up to 12 breakable trees |

The sequence repeats with higher levels, gradually increasing speed and durability (capped at seven hits). Variants reuse the original Yeti animation with recoloring and added details. Trees planted by Tree Yetis follow the existing ball/chain rules.

## Playing with a partner

- Phone: drag the large ski pad left/right to steer, up to brake, down to tuck. Separate Brake, Tuck, and Jump buttons support simultaneous touches. Portrait and landscape layouts both work.
- Keyboard: left/right or A/D steer; up or W brake; down or S tuck; Space jumps. Shift also tucks.
- Stretch the chain to pull and bounce toward each other. Sweep it through trees, rocks, skiers, snowboarders, dogs, and the yeti. Character hits produce bloody particle explosions and snow splatters; scenery shatters. Blood and sound can be toggled in the menu.
- Trees and large pines require a chain impact speed of 150 world units/second; normal downhill speed is 118 and tucking reaches 185. Speed is measured at the struck chain segment, perpendicular to the chain, so a fast swing can also cut a tree. Slow tree hits stop the pair.
- Metal poles are indestructible. Hitting one with the chain or either skier stops the pair, even at full speed or while jumping. Steer sideways around the obstacle to resume. Pole hits give no points.
- Both skiers stay in the camera’s view. Watch the tension meter, chain hits, and shared score. Nearby hits earn combo multipliers.
- The yeti pursues the pair at 2,000 meters. Kill it with the chain and keep skiing into the next Yeti level automatically.
- Keep both game tabs visible. Switching away or disconnecting pauses the run. A disconnected guest can reconnect to the same host and resume.

## Multiplayer and connection troubleshooting

PeerJS handles room discovery; WebRTC carries the game data. The host simulates both skiers at 60 Hz and sends authoritative snapshots at 20 Hz. The guest sends bounded inputs at 30 Hz and interpolates snapshots. The same collision events, explosion seeds, score, and yeti state reach both players. A third player is rejected.

GitHub Pages supplies static files. The default public PeerJS signaling service and Google/Twilio STUN services must be reachable. Direct peer connections depend on the networks and browser permissions; they cannot be guaranteed on every router or carrier. No relay account is bundled. Optional TURN URL, username, and password fields in Connection help support a relay you provide. They stay in page memory. A custom TLS PeerServer can also be configured.

On Android, check the browser’s Nearby devices / Local network permission when same-Wi-Fi connections fail. On other systems, allow local-network access when asked. Router client isolation and host firewalls may also prevent direct connections. Two-character room codes are convenient invitations, not secure passwords.

## Development

Requires Node 22+, npm, and Python 3 (standard library only).

```sh
npm ci
npm run prepare:vendor
npm start
```

Open http://127.0.0.1:4177/. `prepare:vendor` bundles pinned PeerJS and rebuilds the sprite atlases from the archive. The executable is read as data and never launched. Its SHA-256 is included in `site/assets/sprites.json`.

```sh
npm run check
npm test
npm run test:browser
npm run test:solo-view
npm run test:waves
npm run test:network
npm run test:webkit
npm run test:yetis
```

Chrome browser tests require installed Google Chrome. The WebKit smoke test requires `npx playwright install webkit`, or `WEBKIT_EXECUTABLE` pointing to an installed Playwright WebKit executable. Network tests require internet access to the public signaling service. `SKIFREE_URL` can point the Chrome browser/network tests at the deployed site. Screenshots are written to ignored `test-results/`. The optional `?debug` query exposes the current local simulation for testing; it grants no additional authority over other clients.

Set `SKIFREE_SOLO=1` when running `test:browser` or `test:webkit` to exercise the solo mode, touch controls, rotation, and restart. Solo physics tests run with `npm test` and cover ball momentum, swept impact, tree/pole exceptions, snag recovery, both yeti weapons, and long-run determinism.

Tests cover spring momentum and recoil, swept collisions, one-time kills and scoring, bloody yeti destruction, the 2,000 m trigger, long-run deterministic bounds, protocol validation, phone multi-touch/layout, two-browser gameplay, third-player rejection, pause/resume, and reconnection. Browser device emulation is not a substitute for physical Android/iPhone testing on the players’ actual Wi-Fi.

Pushing `main` runs syntax and physics/protocol checks and deploys `site/` through GitHub Actions to GitHub Pages.

## Source layout

- `site/solo-physics.js`: one-skier simulation, heavy rolling ball, weighted tether, separate ball/chain collision rules.
- `site/yetis.js`: escalating Yeti profiles, cyborg charges, super weaving, and bounded tree planting.
- `site/physics.js`: authoritative fixed-step simulation, spring, swept collisions, procedural terrain, yeti, scoring.
- `site/room.js`, `site/protocol.js`: peer connection lifecycle and input/state validation.
- `site/view.js`, `site/sound.js`: original sprite rendering, camera, chain, particles, generated audio.
- `site/app.js`, `site/index.html`, `site/style.css`: rooms, game lifecycle, responsive controls.
- `scripts/assets.py`: original PE bitmap extraction and PNG atlas generation.

Original SkiFree assets remain the work of their original creator; no ownership of those assets is claimed. PeerJS’s MIT license is copied alongside its distributed bundle.
