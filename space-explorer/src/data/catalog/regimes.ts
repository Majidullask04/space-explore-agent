import type { RegimeDef, ScaleRegime } from "./types"
import { AU, LIGHT_YEAR } from "./units"

export const REGIMES: RegimeDef[] = [
  { id: "earth_map", label: "Earth Surface", scaleM: 1.2e7, units: "km" },
  { id: "earth_orbit", label: "Earth Orbit", scaleM: 6.4e7, units: "km" },
  { id: "solar_system", label: "Solar System", scaleM: 6e12, units: "AU" },
  { id: "interstellar", label: "Interstellar", scaleM: 6e16, units: "ly" },
  { id: "milky_way", label: "Milky Way", scaleM: 1e21, units: "ly" },
  { id: "observable_universe", label: "Observable Universe", scaleM: 9e26, units: "Bly" },
]

export const REGIME_INDEX: Record<ScaleRegime, number> = {
  earth_map: 0,
  earth_orbit: 1,
  solar_system: 2,
  interstellar: 3,
  milky_way: 4,
  observable_universe: 5,
}

export const AU_M = AU
export const LY_M = LIGHT_YEAR
