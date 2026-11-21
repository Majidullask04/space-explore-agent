import type { AgentPlan, AgentToolCall } from "./types"
import { MISSION_LIBRARY } from "./types"

/**
 * Deterministic local intent-router + mission planner.
 *
 * This is the mandatory zero-key fallback: any natural-language command that
 * doesn't require an LLM is parsed here so the app works fully offline.
 */

const REGIME_ALIASES: Record<string, string> = {
  earth: "earth_map",
  map: "earth_map",
  surface: "earth_map",
  "earth orbit": "earth_orbit",
  orbit: "earth_orbit",
  "solar system": "solar_system",
  planet: "solar_system",
  interstellar: "interstellar",
  stars: "interstellar",
  "milky way": "milky_way",
  galaxy: "milky_way",
  universe: "observable_universe",
  "observable universe": "observable_universe",
  cosmos: "observable_universe",
  "edge of universe": "observable_universe",
}

const BODY_ALIASES: Record<string, { id: string; regime: string }> = {
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
  moon: { id: "moon", regime: "earth_orbit" },
  iss: { id: "iss", regime: "earth_orbit" },
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
  "sagittarius a*": { id: "sagittarius-a-star", regime: "milky_way" },
  "galactic center": { id: "sagittarius-a-star", regime: "milky_way" },
  "orion nebula": { id: "orion-nebula", regime: "milky_way" },
  "pillars of creation": { id: "pillars-of-creation", regime: "milky_way" },
  "crab nebula": { id: "crab-nebula", regime: "milky_way" },
  "messier 13": { id: "messier-13", regime: "milky_way" },
  andromeda: { id: "andromeda", regime: "observable_universe" },
  "m31": { id: "andromeda", regime: "observable_universe" },
  triangulum: { id: "triangulum", regime: "observable_universe" },
  "m33": { id: "triangulum", regime: "observable_universe" },
  "virgo supercluster": { id: "virgo-supercluster", regime: "observable_universe" },
  laniakea: { id: "laniakea", regime: "observable_universe" },
}

export function planFromQuery(query: string): AgentPlan {
  const q = query.toLowerCase().trim()

  // Mission library matches
  for (const [key, mission] of Object.entries(MISSION_LIBRARY)) {
    if (q.includes(key) || (key === "solar_tour" && q.includes("tour") && q.includes("solar"))) {
      const steps: AgentToolCall[] = [
        { tool: "run_mission_tour", args: { missionKey: key } },
      ]
      return { steps, narration: mission.label, fallback: true }
    }
  }

  // Compare request
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

  // Fly to a specific body
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

  // Regime request
  let matchedRegime: string | null = null
  for (const [alias, regime] of Object.entries(REGIME_ALIASES)) {
    if (q.includes(alias)) {
      matchedRegime = regime
      break
    }
  }
  if (matchedRegime) {
    return {
      steps: [{ tool: "set_scale_regime", args: { regime: matchedRegime } }],
      narration: `Shifting to ${matchedRegime}`,
      fallback: true,
    }
  }

  // ISS tracking
  if (q.includes("iss") || q.includes("space station")) {
    return {
      steps: [{ tool: "fetch_live_iss", args: {} }],
      narration: "Fetching live ISS telemetry",
      fallback: true,
    }
  }

  // Layers toggle
  if (q.includes("layer") || q.includes("overlay") || q.includes("label")) {
    return {
      steps: [{ tool: "toggle_layers", args: { layer: "labels", value: !q.includes("hide") } }],
      narration: "Toggling overlay layers",
      fallback: true,
    }
  }

  return {
    steps: [],
    narration: "I didn't recognize that command. Try: 'fly to Saturn', 'compare Earth and Mars', or 'go to Andromeda'.",
    fallback: true,
  }
}

function extractBodies(q: string): { id: string; regime: string }[] {
  const found: { id: string; regime: string }[] = []
  for (const [alias, body] of Object.entries(BODY_ALIASES)) {
    if (q.includes(alias)) {
      found.push(body)
    }
  }
  return found
}
