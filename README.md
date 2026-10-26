# SkiFree: Chain Reaction

[Play on GitHub Pages](https://jpdieffe.github.io/skifree/)

Two visible skiers share a downhill run, connected by an elastic, lethal chain. Host a two-character room, share its invitation, and your friend joins as the blue skier. The run begins when both players connect. You can also practice with a bot partner.

This is a **browser adaptation**, with new simulation and procedural slopes, using the original SkiFree artwork extracted from the supplied Windows game. It does not execute or emulate the original EXE. The supplied archive is preserved unchanged at `assets/ski32-original.zip`. SkiFree and its original artwork are by Chris Pirih: https://ski.ihoc.net/.

## Playing

- Phone: drag the large ski pad left/right to steer, up to brake, down to tuck. Separate Brake, Tuck, and Jump buttons support simultaneous touches. Portrait and landscape layouts both work.
- Keyboard: left/right or A/D steer; up or W brake; down or S tuck; Space jumps. Shift also tucks.
- Stretch the chain to pull and bounce toward each other. Sweep it through trees, rocks, skiers, snowboarders, dogs, and the yeti. Character hits produce bloody particle explosions and snow splatters; scenery shatters. Blood and sound can be toggled in the menu.
- Both skiers stay in the camera’s view. Watch the tension meter, chain hits, and shared score. Nearby hits earn combo multipliers.
- The yeti pursues the pair at 2,000 meters. Kill it with the chain to win, then choose another run or continue in endless mode.
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
npm run test:network
npm run test:webkit
```

Chrome browser tests require installed Google Chrome. The WebKit smoke test requires `npx playwright install webkit`, or `WEBKIT_EXECUTABLE` pointing to an installed Playwright WebKit executable. Network tests require internet access to the public signaling service. `SKIFREE_URL` can point the Chrome browser/network tests at the deployed site. Screenshots are written to ignored `test-results/`. The optional `?debug` query exposes the current local simulation for testing; it grants no additional authority over other clients.

Tests cover spring momentum and recoil, swept collisions, one-time kills and scoring, bloody yeti destruction, the 2,000 m trigger, long-run deterministic bounds, protocol validation, phone multi-touch/layout, two-browser gameplay, third-player rejection, pause/resume, and reconnection. Browser device emulation is not a substitute for physical Android/iPhone testing on the players’ actual Wi-Fi.

Pushing `main` runs syntax and physics/protocol checks and deploys `site/` through GitHub Actions to GitHub Pages.

## Source layout

- `site/physics.js`: authoritative fixed-step simulation, spring, swept collisions, procedural terrain, yeti, scoring.
- `site/room.js`, `site/protocol.js`: peer connection lifecycle and input/state validation.
- `site/view.js`, `site/sound.js`: original sprite rendering, camera, chain, particles, generated audio.
- `site/app.js`, `site/index.html`, `site/style.css`: rooms, game lifecycle, responsive controls.
- `scripts/assets.py`: original PE bitmap extraction and PNG atlas generation.

Original SkiFree assets remain the work of their original creator; no ownership of those assets is claimed. PeerJS’s MIT license is copied alongside its distributed bundle.
