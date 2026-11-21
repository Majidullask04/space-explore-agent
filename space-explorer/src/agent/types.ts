import type { LayerState } from "../data/types"
import type { RegimeId } from "../data/types"

export type AgentToolName =
  | "locate_user_origin"
  | "fly_to_target"
  | "set_scale_regime"
  | "run_mission_tour"
  | "set_time_warp"
  | "fetch_nasa_media"
  | "fetch_live_space_weather"
  | "fetch_today_asteroids"
  | "compare_bodies"
  | "toggle_layers"
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
  provider?: string
  model?: string
}

export interface MissionStop {
  id: string
  regime: RegimeId
  label: string
}

export interface Mission {
  label: string
  description: string
  stops: MissionStop[]
}

export const MISSION_LIBRARY: Record<string, Mission> = {
  full_journey: {
    label: "Full journey",
    description: "Surface, orbit, every planet, the nearest stars, the galactic centre, and the cosmic horizon.",
    stops: [
      { id: "origin", regime: "surface", label: "Your location" },
      { id: "earth", regime: "orbit", label: "Earth orbit" },
      { id: "sun", regime: "solar_system", label: "The Sun" },
      { id: "saturn", regime: "solar_system", label: "Saturn" },
      { id: "alpha-centauri", regime: "interstellar", label: "Alpha Centauri" },
      { id: "sagittarius-a-star", regime: "milky_way", label: "Sagittarius A*" },
      { id: "andromeda", regime: "universe", label: "Andromeda" },
      { id: "cmb-horizon", regime: "universe", label: "CMB horizon" },
    ],
  },
  solar_tour: {
    label: "Tour the planets",
    description: "A close pass of the Sun and all eight planets at their real positions for this instant.",
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
  earth_to_mars: {
    label: "Earth to Mars",
    description: "From the Blue Marble to the cold desert world, with the Moon on the way out.",
    stops: [
      { id: "earth", regime: "orbit", label: "Earth" },
      { id: "moon", regime: "solar_system", label: "Moon" },
      { id: "mars", regime: "solar_system", label: "Mars" },
    ],
  },
  interstellar: {
    label: "Nearest stars",
    description: "The real three-dimensional neighbourhood of the Sun, including nearby exoplanet hosts.",
    stops: [
      { id: "proxima-centauri", regime: "interstellar", label: "Proxima Centauri" },
      { id: "alpha-centauri", regime: "interstellar", label: "Alpha Centauri" },
      { id: "trappist-1", regime: "interstellar", label: "TRAPPIST-1" },
      { id: "kepler-186f", regime: "interstellar", label: "Kepler-186 f" },
      { id: "betelgeuse", regime: "interstellar", label: "Betelgeuse" },
    ],
  },
  galaxy: {
    label: "Across the Milky Way",
    description: "The Orion Arm, nearby nebulae, and the supermassive black hole at the galactic centre.",
    stops: [
      { id: "orion-nebula", regime: "milky_way", label: "Orion Nebula" },
      { id: "eagle-nebula", regime: "milky_way", label: "Eagle Nebula" },
      { id: "carina-nebula", regime: "milky_way", label: "Carina Nebula" },
      { id: "sagittarius-a-star", regime: "milky_way", label: "Sagittarius A*" },
    ],
  },
  universe: {
    label: "To the horizon",
    description: "The Local Group, Virgo, Laniakea, and the cosmic microwave background.",
    stops: [
      { id: "local-group", regime: "universe", label: "Local Group" },
      { id: "andromeda", regime: "universe", label: "Andromeda" },
      { id: "virgo-cluster", regime: "universe", label: "Virgo Cluster" },
      { id: "laniakea", regime: "universe", label: "Laniakea" },
      { id: "cmb-horizon", regime: "universe", label: "CMB horizon" },
    ],
  },
  live_iss: {
    label: "Track the ISS",
    description: "The live orbital position of the International Space Station above the real Earth.",
    stops: [{ id: "iss", regime: "orbit", label: "ISS" }],
  },
  habitable_worlds: {
    label: "Habitable worlds",
    description: "Confirmed exoplanets in or near the habitable zone of their host stars.",
    stops: [
      { id: "proxima-b", regime: "interstellar", label: "Proxima b" },
      { id: "trappist-1e", regime: "interstellar", label: "TRAPPIST-1 e" },
      { id: "kepler-186f", regime: "interstellar", label: "Kepler-186 f" },
      { id: "k2-18b", regime: "interstellar", label: "K2-18 b" },
      { id: "toi-700d", regime: "interstellar", label: "TOI-700 d" },
    ],
  },
}

export const ALL_TOOLS: AgentToolName[] = [
  "locate_user_origin",
  "fly_to_target",
  "set_scale_regime",
  "run_mission_tour",
  "set_time_warp",
  "fetch_nasa_media",
  "fetch_live_space_weather",
  "fetch_today_asteroids",
  "compare_bodies",
  "toggle_layers",
  "fetch_live_iss",
]

export const TIME_WARP_OPTIONS = [
  { label: "Real time", value: 1 },
  { label: "1 hour/s", value: 3600 },
  { label: "1 day/s", value: 86400 },
  { label: "1 week/s", value: 604800 },
  { label: "1 month/s", value: 2592000 },
  { label: "1 year/s", value: 31557600 },
] as const

export type { LayerState }
export const LAYER_KEYS: Array<keyof LayerState> = [
  "orbits",
  "labels",
  "constellations",
  "spacecraft",
  "belts",
  "grid",
]
