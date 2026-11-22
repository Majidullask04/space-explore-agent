# space-explore-agent

A photorealistic, continuous Space Exploration Platform. Start at your own location on Earth and travel in one uninterrupted gesture to the edge of the observable universe — 93 billion light-years away — and back.

There is no HUD furniture: no search bars, command dock, topic chips or checkbox panels. The 3D universe is full-bleed. Only two whisper-quiet overlays remain: a top-left physical readout (distance and light-travel time) and a far-right hairline depth scrubber.

---

## Quick start

```bash
npm install          # workspace root
npm run dev          # Vite dev server for space-explorer
npm run build        # tsc -b && vite build
npm run lint         # oxlint
npm run verify:shots # headless six-scale visual QA (needs Chrome)
```

The app runs with zero configuration. `NASA_API_KEY` is optional and defaults to `DEMO_KEY`; copy `space-explorer/.env.example` to `.env` to set your own key.

---

## Interaction

| Gesture | Result |
|---|---|
| Wheel / trackpad / two-finger pinch | Physical inertia-driven logarithmic zoom through 25 orders of magnitude |
| Drag (mouse or one finger) | Orbit the active focal point at any depth |
| Tap a body or its label | Damped spline flight to the target, then its NASA fact sheet |
| Scroll or drag while focused | Manual control resumes instantly; the fact sheet dismisses |
| Far-right hairline scrubber | Jump or gently scrub across the entire observable depth |

---

## The six regimes (one continuous scale)

| Range (`logDist`, metres) | Regime | Contents |
|---|---|---|
| 2.0 – 5.4 | Your Earth location | NASA GIBS Blue Marble / VIIRS satellite mosaic, your coordinates |
| 4.6 – 8.8 | Atmosphere & orbit | GLSL Earth (Blue Marble day, Black Marble night lights, ocean glint, clouds, Rayleigh limb), real UTC terminator, Moon, live ISS |
| 7.8 – 13.8 | Sun & Solar System | Limb-darkened Sun with corona, all 8 planets on real heliocentric orbits, Moon, Galilean moons, asteroid/Kuiper belts, Saturn's shadowed rings, Voyager 1/2, JWST, Parker Solar Probe, New Horizons |
| 12.6 – 18.2 | Interstellar neighbourhood | 19,210-star Hipparcos/HYG catalogue with real parallax and blackbody colours, nearby named stars and confirmed exoplanet fields |
| 17.0 – 22.8 | Milky Way | ~96,000-particle volumetric galaxy: warm bar and bulge, logarithmic spiral arms, diffuse disk, dust lanes, Orion Arm origin, particle nebulae |
| 21.5 – 26.944 | Local Group → Universe | Milky Way + Andromeda + Triangulum, 3D filamentary cosmic web with supercluster cores, particulate Planck CMB horizon at 93 Bly |

Regime weights crossfade continuously; a single logarithmic coordinate drives both rendering and the telemetry. Beyond the surface the readout is the true physical distance (`km → AU → ly → kly → Mly → Bly`) with its light-travel time (`ms → s → min → hr → yr → Myr → Byr`). The surface regime renders a fixed regional mosaic, so there the readout reports the ground actually framed by the camera (e.g. ~666 km across the launch view) and hands back to the coordinate as that plate fades into the globe.

---

## Live NASA science

The Vite dev/preview server mounts the NASA proxy at `/api/nasa/*`, which removes browser CORS problems, caches responses on disk, and degrades to the app's verified snapshots with HTTP 200 when an upstream is rate-limited or unavailable.

- ISS position and velocity: `api.wheretheiss.at`, smoothed between samples
- Confirmed exoplanets: NASA Exoplanet Archive TAP (`pscomppars`)
- Today's near-Earth objects: `api.nasa.gov/neo/rest/v1/feed`
- Active solar flares: `api.nasa.gov/DONKI/FLR`
- Imagery: `images-api.nasa.gov` (NASA/Hubble/JWST photographs with caption and credit)
- Surface imagery: NASA GIBS WMTS `BlueMarble_ShadedRelief_Bathymetry` / VIIRS true colour

Planetary and lunar positions, and the subsolar terminator, come from `astronomy-engine` for the actual UTC instant.

---

## Architecture

```
space-explorer/
├── src/
│   ├── App.tsx                     # Canvas + two overlays + on-demand fact sheet
│   ├── components/
│   │   ├── SceneCanvas.tsx         # Engine host, star/ISS/exoplanet loading
│   │   └── HUD/
│   │       ├── MinimalHUD.tsx      # Top-left readout + hairline scrubber
│   │       └── FactCard.tsx        # NASA fact sheet, imagery, live telemetry
│   ├── engine/
│   │   ├── CosmicEngine.ts         # Render loop, regimes, opacity crossfades, picking
│   │   ├── CameraRig.ts            # Damped orbit/pinch/wheel + GSAP flights
│   │   ├── scaleController.ts      # logDist, regime weights, units, camera curve
│   │   ├── SceneBuilder.ts         # Six regimes, catalog bodies, particles
│   │   ├── earthMaterial.ts        # Earth/cloud/atmosphere/Sun GLSL shaders
│   │   ├── helpers.ts              # Star shaders, markers, disposal
│   │   └── textures.ts             # GIBS mosaic + procedural textures
│   ├── data/
│   │   ├── bodies.ts               # Verified physical constants and captions
│   │   ├── snapshots.ts            # Offline fallbacks
│   │   └── catalog/                # Units, regimes, per-scale catalogues
│   ├── hooks/                      # Geolocation, live ISS
│   └── styles/                     # Tokens, minimal HUD
├── server/nasa-api.mjs             # Shared NASA proxy (dev, preview, standalone)
├── scripts/verify-shots.mjs        # Puppeteer visual QA
└── public/                         # NASA textures, star catalogue, fonts
```

`my-time/` and `cosmos/` are preserved untouched as reference projects.

---

## Verification

`npm run verify:shots` boots the production build, drives the engine through all six regimes, captures a screenshot of each plus an open NASA fact sheet, and fails on:

- any search bar, chip row, checkbox panel or boxed ladder
- missing/incorrect distance or light-time units at any scale
- an empty frame at any scale
- a fact sheet that does not open or dismiss on scroll
- any console error or WebGL shader error

Screenshots and `verify-report.json` are written to `space-explorer/.shots/`.

---

## Credits

Three.js, React 19, Vite, GSAP, `astronomy-engine`. Planetary textures NASA/JPL/USGS; imagery NASA, ESA, Hubble and JWST. ISS data via wheretheiss.at. Hipparcos/HYG star catalogue via astronexus/HYG-Database.
