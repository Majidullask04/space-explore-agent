import type { ScaleRegime } from "../data/catalog/types"

export type AgentToolName =
  | "locate_user_origin"
  | "fly_to_target"
  | "set_scale_regime"
  | "run_mission_tour"
  | "set_time_warp"
  | "toggle_layers"
  | "compare_bodies"
  | "fetch_live_iss"

export interface AgentToolCall {
  tool: AgentToolName
  args: Record<string, unknown>
}

export interface AgentResult {
  tool: AgentToolName
  ok: boolean
  summary: string
  args: Record<string, unknown>
}

export interface AgentPlan {
  steps: AgentToolCall[]
  narration: string
  fallback: boolean
}

export interface LayerState {
  orbits: boolean
  labels: boolean
  constellations: boolean
  habitableZone: boolean
  spacecraft: boolean
  cosmicGrid: boolean
}

export interface MissionStop {
  id: string
  regime: ScaleRegime
  label: string
}

export const MISSION_LIBRARY: Record<string, { label: string; stops: MissionStop[] }> = {
  full_journey: {
    label: "Full Journey: My Location -> Edge of Universe",
    stops: [
      { id: "origin", regime: "earth_map", label: "Your Location" },
      { id: "earth", regime: "earth_orbit", label: "Earth Orbit" },
      { id: "sun", regime: "solar_system", label: "The Sun" },
      { id: "saturn", regime: "solar_system", label: "Saturn" },
      { id: "alpha-centauri", regime: "interstellar", label: "Alpha Centauri" },
      { id: "sagittarius-a-star", regime: "milky_way", label: "Galactic Core" },
      { id: "andromeda", regime: "observable_universe", label: "Andromeda" },
    ],
  },
  solar_tour: {
    label: "Tour the Solar System",
    stops: [
      { id: "sun", regime: "solar_system", label: "Sun" },
      { id: "mercury", regime: "solar_system", label: "Mercury" },
      { id: "venus", regime: "solar_system", label: "Venus" },
      { id: "earth", regime: "solar_system", label: "Earth" },
      { id: "mars", regime: "solar_system", label: "Mars" },
      { id: "jupiter", regime: "solar_system", label: "Jupiter" },
      { id: "saturn", regime: "solar_system", label: "Saturn" },
      { id: "uranus", regime: "solar_system", label: "Uranus" },
      { id: "neptune", regime: "solar_system", label: "Neptune" },
    ],
  },
  nearest_exoplanets: {
    label: "Nearest Exoplanets",
    stops: [
      { id: "proxima-centauri", regime: "interstellar", label: "Proxima Centauri" },
      { id: "trappist-1", regime: "interstellar", label: "TRAPPIST-1" },
      { id: "kepler-186f", regime: "interstellar", label: "Kepler-186f" },
    ],
  },
  track_iss: {
    label: "Track Live ISS",
    stops: [{ id: "iss", regime: "earth_orbit", label: "ISS" }],
  },
}

export const ALL_TOOLS: AgentToolName[] = [
  "locate_user_origin",
  "fly_to_target",
  "set_scale_regime",
  "run_mission_tour",
  "set_time_warp",
  "toggle_layers",
  "compare_bodies",
  "fetch_live_iss",
]
