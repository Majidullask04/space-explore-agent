import type { AgentPlan, AgentToolCall } from "./types"
import { MISSION_LIBRARY } from "./types"

/**
 * Deterministic local intent-router + mission planner.
 *
 * This is the mandatory zero-key fallback: any natural-language command that
 * doesn't require an LLM is parsed here so the app works fully offline.
 * All regime ids now use the new six-scale set: surface, orbit, solar_system,
 * interstellar, milky_way, universe.
 */

/**
 * Maps natural-language / mission-library aliases to the new RegimeId set.
 * Order matters: first match wins.
 */
const REGIME_ALIASES: Record<string, string> = {
  // Surface / origin
  here: "surface",
  my_location: "surface",
  "my location": "surface",
  location: "surface",
  "surface": "surface",
  "earth map": "surface",
  "blue marble": "surface",
  earth: "surface",

  // Orbit / ascent
  "earth orbit": "orbit",
  "low earth": "orbit",
  orbit: "orbit",
  "geostationary": "orbit",
  "geo orbit": "orbit",

  // Solar system
  "solar system": "solar_system",
  "planets": "solar_system",
  planet: "solar_system",

  // Interstellar
  interstellar: "interstellar",
  "nearby stars": "interstellar",
  stars: "interstellar",
  "exoplanets": "interstellar",

  // Milky Way
  "milky way": "milky_way",
  galaxy: "milky_way",
  "spiral galaxy": "milky_way",

  // Universe / observable
  universe: "universe",
  "observable universe": "universe",
  cosmos: "universe",
  "edge of universe": "universe",
  "local group": "universe",
  "supercluster": "universe",
}

/**
 * Maps common body/catalog ids to their regime + id.
 * These are the canonical catalog ids the agent may be asked to fly-to.
 */
const BODY_ALIASES: Record<string, { id: string; regime: string }> = {
  // Solar System bodies
  sun: { id: "sun", regime: "solar_system" },
  mercury: { id: "mercury", regime: "solar_system" },
  venus: { id: "venus", regime: "solar_system" },
  earth: { id: "earth", regime: "solar_system" },
  mars: { id: "mars", regime: "solar_system" },
  jupiter: { id: "jupiter", regime: "solar_system" },
  saturn: { id: "saturn", regime: "solar_system" },
  uranus: { id: "uranus", regime: "solar_system" },
  neptune: { id: "neptune", regime: "solar_system" },
  pluto: { id: "pluto", regime: "solar_system" },
  moon: { id: "moon", regime: "solar_system" },
  iss: { id: "iss", regime: "orbit" },

  // Interstellar stars/objects
  "alpha centauri": { id: "alpha-centauri", regime: "interstellar" },
  "proxima centauri": { id: "proxima-centauri", regime: "interstellar" },
  proxima: { id: "proxima-centauri", regime: "interstellar" },
  "barnard's star": { id: "barnard-star", regime: "interstellar" },
  sirius: { id: "sirius", regime: "interstellar" },
  "epsilon eridani": { id: "epsilon-eridani", regime: "interstellar" },
  "tau ceti": { id: "tau-ceti", regime: "interstellar" },
  "trappist-1": { id: "trappist-1", regime: "interstellar" },
  trappist: { id: "trappist-1", regime: "interstellar" },
  "kepler-186f": { id: "kepler-186f", regime: "interstellar" },
  betelgeuse: { id: "betelgeuse", regime: "interstellar" },

  // Milky Way deep-sky objects
  "sagittarius a*": { id: "sagittarius-a-star", regime: "milky_way" },
  "galactic center": { id: "sagittarius-a-star", regime: "milky_way" },
  "orion nebula": { id: "orion-nebula", regime: "milky_way" },
  "pillars of creation": { id: "pillars-of-creation", regime: "milky_way" },
  "crab nebula": { id: "crab-nebula", regime: "milky_way" },
  "messier 13": { id: "messier-13", regime: "milky_way" },
  andromeda: { id: "andromeda", regime: "universe" },
  "m31": { id: "andromeda", regime: "universe" },
  triangulum: { id: "triangulum", regime: "universe" },
  "m33": { id: "triangulum", regime: "universe" },
  "virgo supercluster": { id: "virgo-supercluster", regime: "universe" },
  laniakea: { id: "laniakea", regime: "universe" },
}

/**
 * Try to extract exactly one body from the query. Returns {id, regime} or
 * empty array if nothing matches.
 */
function extractBodies(q: string): { id: string; regime: string }[] {
  const found: { id: string; regime: string }[] = []
  for (const [alias, body] of Object.entries(BODY_ALIASES)) {
    if (q.includes(alias)) {
      found.push(body)
    }
  }
  return found
}

/** Extract a regime name from the query using the alias map. */
function extractRegime(q: string): string | null {
  for (const [alias, regime] of Object.entries(REGIME_ALIASES)) {
    if (q.includes(alias)) {
      return regime
    }
  }
  return null
}

/**
 * Pull a mission key from the query if it matches a known mission library
 * entry (case-insensitive substring match on the mission key).
 */
function extractMissionKey(q: string): string | null {
  for (const key of Object.keys(MISSION_LIBRARY)) {
    if (q.includes(key)) return key
  }
  return null
}

export function planFromQuery(query: string): AgentPlan {
  const q = query.toLowerCase().trim()

  // 1. Mission library match (highest priority)
  const missionKey = extractMissionKey(q)
  if (missionKey) {
    const mission = MISSION_LIBRARY[missionKey]
    if (mission) {
      const steps: AgentToolCall[] = [
        { tool: "run_mission_tour", args: { missionKey } },
      ]
      return { steps, narration: mission.label, fallback: true }
    }
  }

  // 2. Compare request
  if (q.includes("compare")) {
    const targets = extractBodies(q)
    if (targets.length >= 2) {
      return {
        steps: [{ tool: "compare_bodies", args: { a: targets[0].id, b: targets[1].id } }],
        narration: "Comparing celestial bodies",
        fallback: true,
      }
    }
  }

  // 3. Fly to a specific body (only one match)
  const bodies = extractBodies(q)
  if (bodies.length === 1) {
    const b = bodies[0]
    return {
      steps: [
        { tool: "set_scale_regime", args: { regime: b.regime } },
        { tool: "fly_to_target", args: { targetId: b.id, regime: b.regime } },
      ],
      narration: `Flying to ${b.id}`,
      fallback: true,
    }
  }

  // 4. Regime request (single alias match)
  const matchedRegime = extractRegime(q)
  if (matchedRegime) {
    return {
      steps: [{ tool: "set_scale_regime", args: { regime: matchedRegime } }],
      narration: `Shifting to ${matchedRegime}`,
      fallback: true,
    }
  }

  // 5. ISS tracking
  if (q.includes("iss") || q.includes("space station")) {
    return {
      steps: [{ tool: "fetch_live_iss", args: {} }],
      narration: "Fetching live ISS telemetry",
      fallback: true,
    }
  }

  // 6. Layers toggle
  if (q.includes("layer") || q.includes("overlay") || q.includes("label")) {
    return {
      steps: [{ tool: "toggle_layers", args: { layer: "labels", value: !q.includes("hide") } }],
      narration: "Toggling overlay layers",
      fallback: true,
    }
  }

  // 7. Default fallback
  return {
    steps: [],
    narration: "I didn't recognize that command. Try: 'fly to Saturn', 'compare Earth and Mars', or 'go to Andromeda'.",
    fallback: true,
  }
}