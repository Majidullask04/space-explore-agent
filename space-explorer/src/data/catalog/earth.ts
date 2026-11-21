import type { CelestialBody } from "./types"

export const EARTH_RADIUS_M = 6.371e6

export interface EarthOrigin {
  lat: number
  lng: number
  label: string
  acquired: boolean
}

export const DEFAULT_ORIGIN: EarthOrigin = {
  lat: 12.9716,
  lng: 77.5946,
  label: "Bengaluru, India",
  acquired: false,
}

export const EARTH_BODY: CelestialBody = {
  id: "earth",
  name: "Earth",
  regime: "solar_system",
  distFromOriginM: 0,
  distFromEarthM: 0,
  profile: {
    radiusM: EARTH_RADIUS_M,
    massKg: 5.972e24,
    surfaceG: 9.81,
    rotationHours: 23.934,
    meanTempK: 288,
    albedo: 0.37,
    color: "#2d6b9e",
  },
  marker: "origin",
  description: "Your home world. Origin of the journey.",
}

export const MOON_BODY: CelestialBody = {
  id: "moon",
  name: "Moon",
  regime: "orbit",
  distFromOriginM: 3.844e8,
  distFromEarthM: 3.844e8,
  profile: {
    radiusM: 1.737e6,
    massKg: 7.342e22,
    surfaceG: 1.62,
    rotationHours: 655.7,
    meanTempK: 220,
    albedo: 0.12,
    color: "#b8b2a8",
  },
  description: "Earth's only natural satellite.",
}

export const ORBIT_ALTITUDES = {
  karamanLine: 100e3,
  leo: 400e3,
  geo: 35786e3,
}
