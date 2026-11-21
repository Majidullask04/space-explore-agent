import type { CelestialBody, ScaleRegime } from "./types"
import { SOLAR_SYSTEM } from "./solarSystem"
import { INTERSTELLAR } from "./interstellar"
import { MILKY_WAY } from "./galaxy"
import { UNIVERSE } from "./universe"
import { EARTH_BODY, MOON_BODY } from "./earth"

export { AU as AU_M, LIGHT_YEAR as LY_M } from "./units"
export { REGIMES, REGIME_INDEX } from "./regimes"
export { formatDistance, lightTravelLabel, lightTravelYears, type DistanceLabel, type DistanceUnit } from "./units"
export type { CelestialBody, ScaleRegime, BodyProfile, SiteFrame } from "./types"

export const SOLAR_SYSTEM_BODIES = SOLAR_SYSTEM
export const INTERSTELLAR_BODIES = INTERSTELLAR
export const MILKY_WAY_BODIES = MILKY_WAY
export const UNIVERSE_BODIES = UNIVERSE

export function bodyForRegime(regime: ScaleRegime): CelestialBody[] {
  switch (regime) {
    case "surface":
      return [EARTH_BODY]
    case "orbit":
      return [EARTH_BODY, MOON_BODY]
    case "solar_system":
      return SOLAR_SYSTEM
    case "interstellar":
      return INTERSTELLAR
    case "milky_way":
      return MILKY_WAY
    case "universe":
      return UNIVERSE
    default:
      return []
  }
}

export function findBody(id: string): CelestialBody | undefined {
  const all = [...SOLAR_SYSTEM, ...INTERSTELLAR, ...MILKY_WAY, ...UNIVERSE]
  return all.find((b) => b.id === id)
}