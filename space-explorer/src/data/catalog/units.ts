/** Unit conversion helpers for astronomical distances. */

export const AU = 1.495978707e11 // meters
export const LIGHT_YEAR = 9.4607304725808e15 // meters
export const PARSEC = 3.085677581e16 // meters

export type DistanceUnit = "m" | "km" | "AU" | "ly" | "kly" | "Mly" | "Bly"

export interface DistanceLabel {
  value: number
  unit: DistanceUnit
  raw: string
}

/** Pick a sensible unit + number for any SI distance. */
export function formatDistance(meters: number): DistanceLabel {
  const abs = Math.abs(meters)
  if (abs < 1e3) return { value: meters, unit: "m", raw: `${meters.toFixed(0)} m` }
  if (abs < 1e6) return { value: meters / 1e3, unit: "km", raw: `${(meters / 1e3).toFixed(1)} km` }
  if (abs < 1e9) return { value: meters / 1e6, unit: "km", raw: `${(meters / 1e6).toFixed(1)}e3 km` }
  if (abs < AU * 100) return { value: meters / AU, unit: "AU", raw: `${(meters / AU).toFixed(3)} AU` }
  const ly = meters / LIGHT_YEAR
  if (ly < 1e3) return { value: ly, unit: "ly", raw: `${ly.toFixed(2)} ly` }
  if (ly < 1e6) return { value: ly / 1e3, unit: "kly", raw: `${(ly / 1e3).toFixed(2)} kly` }
  if (ly < 1e9) return { value: ly / 1e6, unit: "Mly", raw: `${(ly / 1e6).toFixed(2)} Mly` }
  return { value: ly / 1e9, unit: "Bly", raw: `${(ly / 1e9).toFixed(2)} Bly` }
}

export function lightTravelYears(meters: number): number {
  return meters / LIGHT_YEAR
}

/** Human string for light-travel time given a distance in meters. */
export function lightTravelLabel(meters: number): string {
  const ly = lightTravelYears(meters)
  if (ly < 1e-4) return `${(ly * 365.25 * 24 * 60 * 60).toFixed(0)} s`
  if (ly < 1) return `${(ly * 365.25).toFixed(2)} d`
  if (ly < 1e3) return `${ly.toFixed(2)} yr`
  if (ly < 1e6) return `${(ly / 1e3).toFixed(2)} kyr`
  if (ly < 1e9) return `${(ly / 1e6).toFixed(2)} Myr`
  return `${(ly / 1e9).toFixed(2)} Byr`
}
