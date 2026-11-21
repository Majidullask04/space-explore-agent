export type RegimeId =
  | "surface"
  | "orbit"
  | "solar_system"
  | "interstellar"
  | "milky_way"
  | "universe"

export type BodyKind =
  | "planet"
  | "dwarf"
  | "moon"
  | "star"
  | "exoplanet"
  | "spacecraft"
  | "nebula"
  | "galaxy"
  | "cluster"
  | "region"
  | "blackhole"
  | "belt"
  | "horizon"

export type DistanceUnit = "km" | "au" | "ly" | "mly" | "gly"

export interface Distance {
  unit: DistanceUnit
  value: number
}

export interface Body {
  id: string
  name: string
  kind: BodyKind
  regime: RegimeId
  subtitle: string
  description: string
  /** Restrained base colour used for markers, not for fake emissive planets. */
  color: string
  emissive?: boolean
  texture?: string
  /** Query used against the live NASA Images API. */
  mediaQuery: string
  fallbackImage?: string
  facts: Array<[string, string]>
  missions?: string[]
  /** Static distance from Earth. Solar-system values are computed live. */
  distance?: Distance
  /** Equatorial J2000 coordinates for real stars and deep-sky objects. */
  raDeg?: number
  decDeg?: number
  distLy?: number
  /** Keplerian planet key, when the body is a planet. */
  planetId?: string
  live?: "iss" | "sun" | "planet" | "exoplanet" | "spacecraft"
  notable?: boolean
  /** Relative visual radius hint, 0..1. */
  size?: number
  exoplanetHost?: string
}

export interface StarRecord {
  raDeg: number
  decDeg: number
  mag: number
  bv: number
  distPc: number
  name?: string
}

export interface ExoplanetRecord {
  name: string
  host: string
  raDeg: number
  decDeg: number
  distPc: number
  radiusEarth?: number
  massEarth?: number
  eqTempK?: number
  periodDays?: number
  discoveryYear?: number
  facility?: string
  method?: string
  stars?: number
  planets?: number
}

export interface IssState {
  lat: number
  lng: number
  altitudeKm: number
  velocityKmH: number
  visibility: string
  solarLat: number
  solarLng: number
  timestamp: number
  source: "live" | "cached"
}

export interface FlareRecord {
  id: string
  begin: string
  peak?: string
  end?: string
  classType: string
  sourceLocation?: string
  activeRegion?: string
  link?: string
  source: "live" | "cached"
}

export interface AsteroidRecord {
  id: string
  name: string
  closeApproach: string
  missKm: number
  missLunar: number
  velocityKmH: number
  diameterMinM: number
  diameterMaxM: number
  hazardous: boolean
  source: "live" | "cached"
}

export interface NasaImage {
  id: string
  title: string
  date: string
  center: string
  caption: string
  thumb: string
  full: string
  local?: string
  source: "live" | "cached"
}

export interface LayerState {
  orbits: boolean
  labels: boolean
  constellations: boolean
  spacecraft: boolean
  belts: boolean
  grid: boolean
}

export interface Origin {
  lat: number
  lng: number
  label: string
  source: "geolocation" | "manual" | "timezone" | "default"
}
