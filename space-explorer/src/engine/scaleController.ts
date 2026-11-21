import type { ScaleRegime } from "../data/catalog/types"
import { REGIME_INDEX, REGIMES } from "../data/catalog/regimes"
import { AU, LIGHT_YEAR } from "../data/catalog/units"

/**
 * Floating-origin logarithmic scale manager.
 *
 * The whole universe is mounted in one scene at true relative scales, but we
 * render it by keeping the camera's focal point near the origin and steering
 * the viewer through regime "shells". Because a single scene would suffer
 * float32 jitter over 27 orders of magnitude, we scale each regime's group so
 * that it fits a bounded visual regime (the world is logarithmic in the
 * rendering sense, while the math stays in a stable range).
 */
export const WORLD_SCALE = 1

export const REGIME_WORLD_RADIUS: Record<ScaleRegime, number> = {
  earth_map: 120, // world units = ~120 km worth of surface
  earth_orbit: 640,
  solar_system: 6000,
  interstellar: 30000,
  milky_way: 90000,
  observable_universe: 160000,
}

const REGIME_ORDER: ScaleRegime[] = [
  "earth_map",
  "earth_orbit",
  "solar_system",
  "interstellar",
  "milky_way",
  "observable_universe",
]

export class ScaleController {
  current: ScaleRegime = "earth_map"
  /** 0..1 progress across the whole journey, mapped to index. */
  progress = 0

  setRegime(r: ScaleRegime) {
    this.current = r
    this.progress = REGIME_INDEX[r] / (REGIME_ORDER.length - 1)
  }

  get index(): number {
    return REGIME_INDEX[this.current]
  }

  get label(): string {
    return REGIMES[this.index].label
  }

  next(): ScaleRegime | null {
    const i = this.index + 1
    return i < REGIME_ORDER.length ? REGIME_ORDER[i] : null
  }

  prev(): ScaleRegime | null {
    const i = this.index - 1
    return i >= 0 ? REGIME_ORDER[i] : null
  }

  worldRadiusFor(r: ScaleRegime): number {
    return REGIME_WORLD_RADIUS[r]
  }

  /** Distance label for the ladder (in natural units for the regime). */
  distanceLabel(r: ScaleRegime = this.current): string {
    const m = REGIME_WORLD_RADIUS[r]
    switch (REGIMES[REGIME_INDEX[r]].units) {
      case "AU":
        return `${(m / 1e6).toFixed(0)} AU`
      case "ly":
        return `${(m / 1e6).toFixed(0)} ly`
      case "Bly":
        return `${(m / 1e5).toFixed(1)} Bly`
      case "km":
        return `${(m / 10).toFixed(0)} km`
      default:
        return `${m.toFixed(0)} m`
    }
  }
}

/** Scale a true SI distance to world units for a regime. */
export function metersToWorld(regime: ScaleRegime, meters: number): number {
  const scale = meters / AU
  switch (regime) {
    case "solar_system":
      return scale * 60
    case "interstellar":
      return (meters / LIGHT_YEAR) * 3
    case "milky_way":
      return (meters / LIGHT_YEAR) * 2.2
    case "observable_universe":
      return (meters / LIGHT_YEAR) * 0.0009
    case "earth_orbit":
      return meters / 3e5
    case "earth_map":
      return meters / 8e4
    default:
      return scale
  }
}
