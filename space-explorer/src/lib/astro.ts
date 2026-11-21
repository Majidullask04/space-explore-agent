export const AU_KM = 149_597_870.7
export const LY_KM = 9.4607304725808e12
export const PC_KM = 3.08567758149137e13
export const MLY_KM = LY_KM * 1e6
export const GLY_KM = LY_KM * 1e9
export const EARTH_RADIUS_KM = 6378.137
export const C_KM_S = 299_792.458
export const SUN_RADIUS_KM = 695_700
export const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0)

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface PlanetElements {
  a: number
  e: number
  i: number
  node: number
  peri: number
  m0: number
  periodDays: number
  radiusKm: number
}

/** J2000 mean elements. Values are adequate for visual ephemerides; live
 * Horizons vectors refine the current longitude when available. */
export const PLANET_ELEMENTS: Record<string, PlanetElements> = {
  mercury: { a: 0.38709927, e: 0.20563593, i: 7.00497902, node: 48.33076593, peri: 77.45779628, m0: 174.796, periodDays: 87.9691, radiusKm: 2439.7 },
  venus: { a: 0.72333566, e: 0.00677672, i: 3.39467605, node: 76.67984255, peri: 131.60246718, m0: 50.115, periodDays: 224.701, radiusKm: 6051.8 },
  earth: { a: 1.00000261, e: 0.01671123, i: 0.00001531, node: 0, peri: 102.93768193, m0: 357.517, periodDays: 365.256, radiusKm: 6378.137 },
  mars: { a: 1.52371034, e: 0.0933941, i: 1.84969142, node: 49.55953891, peri: 336.05637041, m0: 19.373, periodDays: 686.98, radiusKm: 3389.5 },
  jupiter: { a: 5.202887, e: 0.04838624, i: 1.30439695, node: 100.47390909, peri: 14.72847983, m0: 20.02, periodDays: 4332.59, radiusKm: 69911 },
  saturn: { a: 9.53667594, e: 0.05386179, i: 2.48599187, node: 113.66242448, peri: 92.59887831, m0: 317.02, periodDays: 10759.22, radiusKm: 58232 },
  uranus: { a: 19.18916464, e: 0.04725744, i: 0.77263783, node: 74.01692503, peri: 170.9542763, m0: 142.238, periodDays: 30688.5, radiusKm: 25362 },
  neptune: { a: 30.06992276, e: 0.00859048, i: 1.77004347, node: 131.78422574, peri: 44.96476227, m0: 256.228, periodDays: 60182, radiusKm: 24622 },
  pluto: { a: 39.48211675, e: 0.2488273, i: 17.14001206, node: 110.30393684, peri: 224.06891629, m0: 14.53, periodDays: 90560, radiusKm: 1188.3 },
}

export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

export function daysSinceJ2000(date: Date): number {
  return (date.getTime() - J2000) / 86400000
}

function solveKepler(M: number, e: number): number {
  let E = M
  for (let i = 0; i < 8; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  }
  return E
}

/** Heliocentric ecliptic position in AU. */
export function planetPositionAu(id: string, date: Date): Vec3 {
  const el = PLANET_ELEMENTS[id]
  if (!el) return { x: 0, y: 0, z: 0 }
  const n = 360 / el.periodDays
  const M = ((el.m0 + n * daysSinceJ2000(date)) % 360) * D2R
  const E = solveKepler(M, el.e)
  const xv = el.a * (Math.cos(E) - el.e)
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E)
  const w = el.peri * D2R
  const node = el.node * D2R
  const inc = el.i * D2R
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  const cn = Math.cos(node)
  const sn = Math.sin(node)
  const ci = Math.cos(inc)
  const si = Math.sin(inc)
  return {
    x: (cw * cn - sw * sn * ci) * xv + (-sw * cn - cw * sn * ci) * yv,
    y: (cw * sn + sw * cn * ci) * xv + (-sw * sn + cw * cn * ci) * yv,
    z: sw * si * xv + cw * si * yv,
  }
}

/** Sample a full osculating orbit for a planet, in AU. */
export function planetOrbitAu(id: string, samples = 256): Vec3[] {
  const el = PLANET_ELEMENTS[id]
  if (!el) return []
  const w = el.peri * D2R
  const node = el.node * D2R
  const inc = el.i * D2R
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  const cn = Math.cos(node)
  const sn = Math.sin(node)
  const ci = Math.cos(inc)
  const si = Math.sin(inc)
  const pts: Vec3[] = []
  for (let k = 0; k < samples; k++) {
    const E = (k / samples) * Math.PI * 2
    const xv = el.a * (Math.cos(E) - el.e)
    const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E)
    pts.push({
      x: (cw * cn - sw * sn * ci) * xv + (-sw * cn - cw * sn * ci) * yv,
      y: (cw * sn + sw * cn * ci) * xv + (-sw * sn + cw * cn * ci) * yv,
      z: sw * si * xv + cw * si * yv,
    })
  }
  return pts
}

/** Convert ecliptic AU coordinates into Three.js scene coordinates (Y up). */
export function eclipticToScene(p: Vec3): Vec3 {
  return { x: p.x, y: p.z, z: -p.y }
}

export function distanceAu(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function planetDistanceAu(id: string, date: Date): number {
  if (id === "sun") {
    const earth = planetPositionAu("earth", date)
    return Math.hypot(earth.x, earth.y, earth.z)
  }
  const earth = planetPositionAu("earth", date)
  return distanceAu(planetPositionAu(id, date), earth)
}

export function planetDistanceKm(id: string, date: Date): number {
  if (id === "moon") return 384400
  return planetDistanceAu(id, date) * AU_KM
}

export function planetLightSeconds(id: string, date: Date): number {
  return planetDistanceKm(id, date) / C_KM_S
}

export function lightSecondsForKm(km: number): number {
  return km / C_KM_S
}

export function lightSecondsForLy(ly: number): number {
  return ly * 365.25 * 86400
}

/** Approximate subsolar point for the current instant. */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const doy = (date.getTime() - start) / 86400000 + 1
  const decl = -23.44 * Math.cos((2 * Math.PI * (doy + 10)) / 365.24)
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const b = (2 * Math.PI * (doy - 81)) / 364
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  let lon = 180 - 15 * hours - eot / 4
  while (lon > 180) lon -= 360
  while (lon < -180) lon += 360
  return { lat: decl, lon }
}

/** Local apparent solar time as seconds since midnight. */
export function localSolarSeconds(lng: number, date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const doy = (date.getTime() - start) / 86400000 + 1
  const b = (2 * Math.PI * (doy - 81)) / 364
  const eotMin = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  let minutes = utcMin + lng * 4 + eotMin
  minutes = ((minutes % 1440) + 1440) % 1440
  return minutes * 60
}

export function formatSolarTime(seconds: number): string {
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600) % 24
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function gmstDegrees(date: Date): number {
  const jd = julianDate(date)
  const T = (jd - 2451545) / 36525
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000
  gmst %= 360
  if (gmst < 0) gmst += 360
  return gmst
}

/** RA/Dec in degrees to a unit vector in the scene's equatorial frame. */
export function raDecToVector(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * D2R
  const dec = decDeg * D2R
  return {
    x: Math.cos(dec) * Math.cos(ra),
    y: Math.sin(dec),
    z: Math.cos(dec) * Math.sin(ra),
  }
}

/** Convert equatorial J2000 coordinates to galactic longitude/latitude. */
export function equatorialToGalactic(raDeg: number, decDeg: number): { l: number; b: number } {
  const ra = raDeg * D2R
  const dec = decDeg * D2R
  const raNGP = 192.85948 * D2R
  const decNGP = 27.12825 * D2R
  const lNCP = 122.93192 * D2R
  const sinB = Math.sin(decNGP) * Math.sin(dec) + Math.cos(decNGP) * Math.cos(dec) * Math.cos(ra - raNGP)
  const b = Math.asin(Math.max(-1, Math.min(1, sinB)))
  const y = Math.cos(dec) * Math.sin(ra - raNGP)
  const x = Math.cos(decNGP) * Math.sin(dec) - Math.sin(decNGP) * Math.cos(dec) * Math.cos(ra - raNGP)
  let l = lNCP - Math.atan2(y, x)
  l = ((l * R2D) % 360 + 360) % 360
  return { l, b: b * R2D }
}

/**
 * Position in the galaxy plane relative to the Sun at (R0, 0, 0).
 * Units are light-years. The Sun sits at x = R0, with the galactic centre at
 * the origin and l = 0 pointing toward the centre.
 */
export function galacticPosition(raDeg: number, decDeg: number, distLy: number, r0 = 26000): Vec3 {
  const { l, b } = equatorialToGalactic(raDeg, decDeg)
  const lr = l * D2R
  const br = b * D2R
  const d = Math.max(0, distLy)
  return {
    x: r0 - d * Math.cos(br) * Math.cos(lr),
    y: d * Math.sin(br),
    z: d * Math.cos(br) * Math.sin(lr),
  }
}

/** Approximate blackbody RGB from B-V colour index, normalised 0..1. */
export function bvToRgb(bv: number): [number, number, number] {
  const t = Math.max(-0.4, Math.min(2.0, bv))
  const kelvin = 4600 * (1 / (0.92 * t + 1.7) + 1 / (0.92 * t + 0.62))
  return kelvinToRgb(kelvin)
}

export function kelvinToRgb(kelvin: number): [number, number, number] {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100
  let r: number
  let g: number
  let b: number
  if (temp <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(temp) - 161.1195681661
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492)
    b = 255
  }
  return [clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)]
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

export function latLonToVector(latDeg: number, lonDeg: number): Vec3 {
  const lat = latDeg * D2R
  const lon = lonDeg * D2R
  return {
    x: Math.cos(lat) * Math.sin(lon),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.cos(lon),
  }
}

export function vectorToLatLon(v: Vec3): { lat: number; lng: number } {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  const lat = Math.asin(v.y / len) * R2D
  const lng = Math.atan2(v.x, v.z) * R2D
  return { lat, lng }
}

export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * D2R
  const p2 = lat2 * D2R
  const dp = (lat2 - lat1) * D2R
  const dl = (lon2 - lon1) * D2R
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export function formatRA(raDeg: number): string {
  const hours = normalizeDegrees(raDeg) / 15
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  const s = ((hours - h) * 60 - m) * 60
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${s.toFixed(1)}s`
}

export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? "-" : "+"
  const abs = Math.abs(decDeg)
  const d = Math.floor(abs)
  const m = Math.floor((abs - d) * 60)
  const s = ((abs - d) * 60 - m) * 60
  return `${sign}${String(d).padStart(2, "0")}deg ${String(m).padStart(2, "0")}m ${s.toFixed(1)}s`
}
