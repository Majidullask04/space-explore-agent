/**
 * Typed celestial catalog types. All distances are stored in SI (meters)
 * as a base unit; the UI converts to m / km / AU / ly / Mly / Bly via
 * the helpers in units.ts.
 */

export type ScaleRegime =
  | "earth_map"
  | "earth_orbit"
  | "solar_system"
  | "interstellar"
  | "milky_way"
  | "observable_universe"

export interface SiteFrame {
  /** Orbital epoch (J2000) in days since J2000 epoch. */
  epoch: number
  a: number // semi-major axis (m)
  e: number // eccentricity
  i: number // inclination (rad)
  omega: number // longitude of ascending node (rad)
  w: number // argument of perihelion (rad)
  M0: number // mean anomaly at epoch (rad)
}

export interface BodyProfile {
  radiusM: number
  massKg: number
  surfaceG: number // m/s^2
  rotationHours: number
  meanTempK: number
  albedo: number
  color: string
  emissive?: boolean
}

export interface CelestialBody {
  id: string
  name: string
  regime: ScaleRegime
  /** Distance from the origin of its parent regime (m). */
  distFromOriginM: number
  /** True distance from Earth (m) for interstellar/universe targets. */
  distFromEarthM: number
  profile: BodyProfile
  orbit?: SiteFrame
  /** Moons / secondary bodies. */
  satellites?: CelestialBody[]
  marker?: "origin" | "core" | "landmark"
  description: string
}

export interface RegimeDef {
  id: ScaleRegime
  label: string
  /** Representative scale (m) — used to size the world and drive the ladder. */
  scaleM: number
  units: "m" | "km" | "AU" | "ly" | "Mly" | "Bly"
}
