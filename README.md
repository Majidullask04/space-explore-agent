# space-explore-agent

A production-grade **Agentic Space Explorer** — explore the entire known cosmos in one continuous outward journey, starting from *where you are right now* on an interactive Earth map, lifting off through the atmosphere into orbit, flying across the Sun and the full Solar System, and continuing outward through nearby stars and exoplanets, the Milky Way galaxy, neighboring galaxies, and the observable universe.

The journey is piloted both **manually** (orbit, zoom, free-fly, click-to-focus, scale ladder) and **autonomously** by an AI **Astrogation Agent** that turns natural language into real flight/simulation commands.

---

## Quick Start

```bash
# 1. Install (workspace root)
npm install

# 2. Run the explorer app (Vite dev, port 5173)
npm run dev

# 3. (Optional) Run the agent backend for live LLM tool-calling
npm run server
```

Open the printed localhost URL in your browser. The app works fully offline with zero configuration — the agent falls back to a **deterministic local planner** when no API key is set.

### Preset missions
Use the **Agent Command Dock** (bottom of the screen) or click any chip to launch a narrated multi-stop flight:

- **Full Journey: My Location → Edge of the Universe**
- **Tour the Solar System**
- **Track Live ISS**
- **Nearest Exoplanets**
- Any natural-language command: *"fly to Saturn's rings"*, *"compare Earth and Mars"*, *"zoom out to Andromeda"*.

---

## Feature Overview

### Six linked spatial scales (~27 orders of magnitude)
| Scale | Regime | Contents |
|---|---|---|
| 0 | `earth_map` | Your geolocated position on an interactive map/globe, live coordinates, zenith vector, **Launch from Here** |
| 1 | `earth_orbit` | Troposphere → Stratosphere → Kármán line → LEO → GEO → full 3D Earth–Moon system, day/night terminator, atmospheric rim glow, live ISS track |
| 2 | `solar_system` | Sun (procedural corona shader), all planets + asteroid & Kuiper belts, Saturn's rings, Galilean moons, Voyager 1/2 trajectories, heliopause, **J2000 Keplerian motion** + time-warp |
| 3 | `interstellar` | Proxima & Alpha Centauri, Barnard's Star, Sirius, Epsilon Eridani, Tau Ceti, TRAPPIST-1, Kepler-186f, Betelgeuse with habitable-zone indicators & light-travel time |
| 4 | `milky_way` | GPU-particle spiral galaxy (~100k ly), Orion Arm (Solar System origin), Sagittarius A*, Orion/Eagle/Crab nebulae, Messier 13 |
| 5 | `observable_universe` | Andromeda (M31), Triangulum (M33), Virgo Supercluster, Laniakea filaments, CMB horizon (~93 Bly) |

Transition is handled by a **floating-origin / multi-regime logarithmic scale controller** with GSAP camera splines and opacity crossfades — zero float32 jitter or Z-fighting.

### Agentic architecture
- **Client-executed tools**: `locate_user_origin`, `fly_to_target`, `set_scale_regime`, `run_mission_tour`, `set_time_warp`, `toggle_layers`, `compare_bodies`, `fetch_live_iss`.
- **`/api/agent`** (Express backend) supports OpenAI / Gemini / OpenAI-compatible structured tool calling.
- **Mandatory zero-key fallback**: a local intent-router + mission planner powers every preset mission and common command offline.
- **Live ISS** fetched from `api.wheretheiss.at` with a graceful simulated fallback.

### Hallmark Vantage design system
- Locked CSS tokens in `src/styles/global.css` (obsidian `#05070B` canvas, slate-glass HUD panels, `#F1F5F9`/`#94A3B8` text, `#38BDF8` telemetry accent, `#F59E0B` active-mission state).
- **Zero emojis** anywhere — crisp geometric `lucide-react` SVG icons only.
- Tabular-nums monospace for all coordinates/altitude/distance/velocity/light-travel time.
- Full-bleed 3D viewport + collapsible HUD: top telemetry strip, left vertical scale ladder, right inspector/compare drawer, bottom agent dock.
- GPU-composited UI transitions, `prefers-reduced-motion`, `dpr` capped at `[1,2]`, instanced meshes, procedural/self-contained textures, proper disposal, WebGL context-loss recovery.

---

## Repository Layout

```
.
├── space-explorer/            # The Agentic Space Explorer app (Vite + React 19 + TS + Three.js + GSAP)
│   ├── src/
│   │   ├── App.tsx            # App shell / HUD orchestration
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── SceneCanvas.tsx        # <canvas> host for the Three.js engine
│   │   │   └── HUD/                   # TopTelemetryBar, ScaleLadder, Inspector,
│   │   │                              # CompareDrawer, LayerControls, AgentCommandDock
│   │   ├── engine/                    # SpaceEngine, SceneBuilder, materials, textures,
│   │   │                              # scaleController (floating-origin / regimes)
│   │   ├── data/catalog/              # Typed astronomical catalog: earth, solarSystem,
│   │   │                              # interstellar, galaxy, universe, regimes, units, types
│   │   ├── agent/                     # intentRouter, executor (tool-calling), types
│   │   ├── hooks/                     # useGeolocation, useLiveISS
│   │   └── styles/                    # global.css (tokens), hud.css
│   ├── server/index.mjs       # Express agent backend: /api/agent + LLM/fallback
│   ├── scripts/verify-shots.mjs  # Headless screenshot QA across all 6 scales
│   ├── vite.config.ts
│   └── package.json
├── cosmos/                    # Archival vanilla Three.js free-flight simulator (reference)
├── my-time/                   # Archival Vite/React/Three scroll-story app (reference toolchain)
└── package.json               # Root scripts wired to run space-explorer
```

**Root scripts** (`npm run …` at the workspace root):

| Script | Runs |
|---|---|
| `dev` | Vite dev server for `space-explorer` |
| `build` | TypeScript typecheck + production build |
| `lint` | Oxlint (zero warnings/errors enforced) |
| `verify:shots` | Headless screenshot QA across all scales |
| `server` | Start the Express agent backend |

---

## Configuration

All settings are optional — the app runs fully offline with no configuration.

| Variable | Purpose | Required |
|---|---|---|
| `VITE_AGENT_PROVIDER` | `openai` \| `gemini` \| `openai-compatible` | No (defaults to fallback) |
| `VITE_AGENT_MODEL` | Model id (e.g. `gpt-4o-mini`) | No |
| `AGENT_API_KEY` | Provider API key (server-side only, never in the client) | No |
| `AGENT_MODEL` | Server-side model override | No |
| `VITE_PROXY_TARGET` | Vite dev proxy target for `/api/agent` | No |

> Secrets are never committed. Add your key to a local `.env` file (gitignored); the `.env.example` documents these names. Without a key, the agent uses the deterministic local planner.

---

## Verification

```bash
cd space-explorer
npm run lint          # oxlint → 0 warnings, 0 errors
npm run build         # tsc -b && vite build → clean bundle
npm run verify:shots  # headless screenshots across earth_map → observable_universe
```

---

## License & Acknowledgments
- Built on Three.js, Vite, React, GSAP, and `lucide-react` (MIT).
- Astronomical catalog uses real physical constants, Keplerian elements, and verified distances.
- ISS data via [wheretheiss.at](https://wheretheiss.at) with offline fallback.
