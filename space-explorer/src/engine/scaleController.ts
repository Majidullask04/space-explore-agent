import type { RegimeId } from "../data/types"
import { AU, LIGHT_YEAR } from "../data/catalog/units"

/**
 * Continuous logarithmic scale constants.
 *
 * `logDist` ranges from 2.0 (10^2 m = 100 meters, Earth surface observer)
 * all the way to 26.944 (10^26.944 m ≈ 8.8e26 m = 93.0 billion light-years,
 * the edge of the Observable Universe).
 */
export const LOG_MIN = 2.0
export const LOG_MAX = 26.944

export const REGIME_LOG_BOUNDS: Record<RegimeId, { min: number; peakMin: number; peakMax: number; max: number }> = {
  surface: { min: 2.0, peakMin: 2.0, peakMax: 4.4, max: 5.4 },
  orbit: { min: 4.6, peakMin: 5.3, peakMax: 7.8, max: 8.8 },
  solar_system: { min: 7.8, peakMin: 8.8, peakMax: 12.6, max: 13.8 },
  interstellar: { min: 12.6, peakMin: 13.8, peakMax: 17.0, max: 18.2 },
  milky_way: { min: 17.0, peakMin: 18.2, peakMax: 21.5, max: 22.8 },
  universe: { min: 21.5, peakMin: 22.8, peakMax: 27.0, max: 27.0 },
}

export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

export function regimeWeight(
  logDist: number,
  min: number,
  peakMin: number,
  peakMax: number,
  max: number,
): number {
  if (logDist <= min || logDist >= max) return 0
  if (logDist >= peakMin && logDist <= peakMax) return 1
  if (logDist < peakMin) {
    return smoothstep((logDist - min) / (peakMin - min))
  }
  return smoothstep((max - logDist) / (max - peakMax))
}

export function getRegimeWeights(logDist: number): Record<RegimeId, number> {
  return {
    surface: regimeWeight(logDist, 2.0, 2.0, 4.4, 5.4),
    orbit: regimeWeight(logDist, 4.6, 5.3, 7.8, 8.8),
    solar_system: regimeWeight(logDist, 7.8, 8.8, 12.6, 13.8),
    interstellar: regimeWeight(logDist, 12.6, 13.8, 17.0, 18.2),
    milky_way: regimeWeight(logDist, 17.0, 18.2, 21.5, 22.8),
    universe: regimeWeight(logDist, 21.5, 22.8, 27.0, 27.0),
  }
}

export function getPrimaryRegime(logDist: number): RegimeId {
  if (logDist < 5.0) return "surface"
  if (logDist < 8.2) return "orbit"
  if (logDist < 13.2) return "solar_system"
  if (logDist < 17.6) return "interstellar"
  if (logDist < 22.2) return "milky_way"
  return "universe"
}

export function getRegionName(logDist: number, city?: string): string {
  if (logDist < 3.2) return city ? `Earth Surface · ${city}` : "Earth Surface"
  if (logDist < 4.5) return "Earth Surface · Planetary Boundary Layer"
  if (logDist < 5.3) return "Stratosphere & Mesosphere"
  if (logDist < 6.5) return "Low Earth Orbit (LEO)"
  if (logDist < 7.8) return "Geostationary Orbit & Cislunar Space"
  if (logDist < 8.6) return "Earth-Moon System"
  if (logDist < 10.2) return "Inner Solar System"
  if (logDist < 11.8) return "Asteroid Belt & Jupiter System"
  if (logDist < 12.8) return "Outer Solar System · Ringed Giants"
  if (logDist < 13.8) return "Kuiper Belt & Heliosphere Horizon"
  if (logDist < 15.2) return "Oort Cloud & Local Interstellar Medium"
  if (logDist < 16.8) return "Local Interstellar Chimney · Alpha Centauri"
  if (logDist < 17.8) return "Solar Neighborhood (Hipparcos Stars)"
  if (logDist < 19.2) return "Milky Way · Orion-Cygnus Arm"
  if (logDist < 20.8) return "Milky Way Galaxy · Galactic Bar & Disk"
  if (logDist < 21.8) return "Milky Way Halo & Satellite Galaxies"
  if (logDist < 23.2) return "Local Group · Milky Way & Andromeda"
  if (logDist < 24.6) return "Virgo Supercluster & Local Void"
  if (logDist < 25.8) return "Laniakea Supercluster · Great Attractor"
  if (logDist < 26.5) return "Cosmic Web · Galaxy Supercluster Filaments"
  return "Observable Universe · Planck CMB Horizon"
}

/**
 * One continuous camera-distance curve, anchored to the aesthetic home
 * distance of every regime. Smooth interpolation through the anchors means a
 * wheel gesture right after landing on a regime never lurches the camera.
 */
const CAMERA_ANCHORS: Array<[number, number]> = [
  // Surface: the camera pulls back monotonically, so pinching in frames less
  // ground instead of more. The pull-in after 4.4 happens under the globe
  // crossfade, where the surface mosaic is already fading out.
  [2.0, 300],
  [2.4, 400],
  [4.4, 440],
  [6.2, 300],
  [8.2, 330],
  [10.5, 300],
  [13.2, 220],
  [16.6, 140],
  [17.6, 160],
  [20.2, 190],
  [22.2, 240],
  [26.5, 300],
  [26.944, 320],
]

export function getCameraDistanceForLogDist(logDist: number): number {
  const clamped = Math.max(LOG_MIN, Math.min(LOG_MAX, logDist))
  for (let i = 1; i < CAMERA_ANCHORS.length; i++) {
    const [x1, y1] = CAMERA_ANCHORS[i - 1]
    const [x2, y2] = CAMERA_ANCHORS[i]
    if (clamped <= x2) {
      const t = (clamped - x1) / (x2 - x1)
      const smooth = t * t * (3 - 2 * t)
      return y1 * Math.pow(y2 / y1, smooth)
    }
  }
  return CAMERA_ANCHORS[CAMERA_ANCHORS.length - 1][1]
}

/** Field of view shared by the camera and the frame-extent readout. */
export const CAMERA_FOV_DEG = 48

export interface SurfacePlate {
  /** Real ground width of the regional mosaic, in metres. */
  widthM: number
  /** Width of the same mosaic in scene units. */
  widthUnits: number
  /** Height of the same mosaic in scene units. */
  heightUnits: number
}

/** Furthest the surface camera can pull back while the mosaic still fills the frame. */
export function surfaceMaxCameraDistance(plateHeightUnits: number, fovDeg = CAMERA_FOV_DEG): number {
  return (plateHeightUnits * 0.96) / (2 * Math.tan((fovDeg * Math.PI) / 360))
}

/**
 * Ground width actually framed by the surface map camera. The surface regime
 * renders a fixed regional mosaic, so the truthful distance is the strip of
 * ground inside the frame rather than the abstract log-depth coordinate.
 */
export function surfaceFrameWidthM(
  cameraDistance: number,
  aspect: number,
  plateWidthM: number,
  plateWidthUnits: number,
  fovDeg = CAMERA_FOV_DEG,
): number {
  const frameUnits = 2 * cameraDistance * Math.tan((fovDeg * Math.PI) / 360) * Math.max(aspect, 0.05)
  return Math.max(0, (frameUnits / plateWidthUnits) * plateWidthM)
}

export function formatPhysicalDistance(meters: number): string {
  if (meters < 1e3) return `${meters.toFixed(0)} m`
  if (meters < 1e6) return `${(meters / 1e3).toFixed(1)} km`
  if (meters < 1e9) return `${Math.round(meters / 1e3).toLocaleString("en-US")} km`
  if (meters < AU * 100) return `${(meters / AU).toFixed(2)} AU`
  const ly = meters / LIGHT_YEAR
  if (ly < 1000) return `${ly.toFixed(1)} ly`
  if (ly < 1e6) return `${(ly / 1e3).toFixed(1)} kly`
  if (ly < 1e9) return `${(ly / 1e6).toFixed(2)} Mly`
  return `${(ly / 1e9).toFixed(2)} Bly`
}

export function formatLightTime(seconds: number): string {
  if (seconds < 1e-4) return `${(seconds * 1e6).toFixed(0)} µs`
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`
  if (seconds < 60) return `${seconds.toFixed(2)} s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m ${s}s`
  }
  if (seconds < 86400) {
    const h = (seconds / 3600).toFixed(1)
    return `${h} hr`
  }
  const days = seconds / 86400
  if (days < 365.25) return `${days.toFixed(1)} d`
  const yr = days / 365.25
  if (yr < 1000) return `${yr.toFixed(1)} yr`
  if (yr < 1e6) return `${(yr / 1e3).toFixed(1)} kyr`
  if (yr < 1e9) return `${(yr / 1e6).toFixed(2)} Myr`
  return `${(yr / 1e9).toFixed(2)} Byr`
}

/** Body-specific characteristic focal logDist values. */
export const BODY_LOG_DIST: Record<string, number> = {
  origin: 2.2,
  earth: 6.2,
  iss: 5.7,
  moon: 8.4,
  sun: 9.2,
  mercury: 9.8,
  venus: 10.0,
  mars: 10.3,
  "asteroid-belt": 11.2,
  jupiter: 11.4,
  io: 11.3,
  europa: 11.3,
  ganymede: 11.3,
  callisto: 11.3,
  saturn: 11.8,
  titan: 11.7,
  enceladus: 11.7,
  uranus: 12.2,
  neptune: 12.4,
  triton: 12.4,
  pluto: 12.6,
  charon: 12.6,
  "kuiper-belt": 12.8,
  "voyager-1": 13.2,
  "voyager-2": 13.1,
  "proxima-centauri": 16.6,
  "alpha-centauri": 16.6,
  "barnard-star": 16.8,
  sirius: 16.9,
  "trappist-1": 17.5,
  betelgeuse: 18.8,
  "sagittarius-a-star": 20.4,
  "orion-nebula": 19.1,
  "carina-nebula": 19.8,
  "eagle-nebula": 19.8,
  "crab-nebula": 19.7,
  "orion-arm": 18.6,
  "local-group": 22.4,
  andromeda: 22.4,
  triangulum: 22.5,
  lmc: 21.2,
  smc: 21.3,
  "virgo-cluster": 23.7,
  "coma-cluster": 24.5,
  laniakea: 24.8,
  "great-attractor": 24.8,
  "cosmic-web": 25.6,
  "cmb-horizon": 26.8,
}
