import type { AsteroidRecord, ExoplanetRecord, FlareRecord, IssState, NasaImage } from "./types"

export const ISS_SNAPSHOT: IssState = {
  lat: 23.18,
  lng: 78.94,
  altitudeKm: 421.3,
  velocityKmH: 27600,
  visibility: "daylight",
  solarLat: 20.1,
  solarLng: 79.4,
  timestamp: 0,
  source: "cached",
}

export const FLARE_SNAPSHOT: FlareRecord[] = [
  {
    id: "2024-05-14-X8.7",
    begin: "2024-05-14T16:51:00Z",
    peak: "2024-05-14T17:08:00Z",
    end: "2024-05-14T17:27:00Z",
    classType: "X8.7",
    sourceLocation: "S17W75",
    activeRegion: "AR3664",
    link: "https://webtools.ccmc.gsfc.nasa.gov/DONKI/",
    source: "cached",
  },
  {
    id: "2024-05-11-X5.8",
    begin: "2024-05-11T16:20:00Z",
    peak: "2024-05-11T16:23:00Z",
    end: "2024-05-11T16:35:00Z",
    classType: "X5.8",
    sourceLocation: "S18W55",
    activeRegion: "AR3664",
    source: "cached",
  },
  {
    id: "2024-02-22-X6.3",
    begin: "2024-02-22T22:07:00Z",
    peak: "2024-02-22T22:15:00Z",
    end: "2024-02-22T22:32:00Z",
    classType: "X6.3",
    sourceLocation: "N20W30",
    activeRegion: "AR3590",
    source: "cached",
  },
]

export const ASTEROID_SNAPSHOT: AsteroidRecord[] = [
  {
    id: "2024-yr4",
    name: "2024 YR4",
    closeApproach: "2032-12-22",
    missKm: 0,
    missLunar: 0,
    velocityKmH: 47900,
    diameterMinM: 40,
    diameterMaxM: 90,
    hazardous: false,
    source: "cached",
  },
  {
    id: "2029-ok",
    name: "99942 Apophis",
    closeApproach: "2029-04-13",
    missKm: 31600,
    missLunar: 0.082,
    velocityKmH: 110000,
    diameterMinM: 310,
    diameterMaxM: 340,
    hazardous: false,
    source: "cached",
  },
  {
    id: "2024-bx1",
    name: "2024 BX1",
    closeApproach: "2024-01-21",
    missKm: 42000,
    missLunar: 0.109,
    velocityKmH: 54000,
    diameterMinM: 1,
    diameterMaxM: 2,
    hazardous: false,
    source: "cached",
  },
]

export const EXOPLANET_SNAPSHOT: ExoplanetRecord[] = [
  {
    name: "Proxima Centauri b",
    host: "Proxima Centauri",
    raDeg: 217.429,
    decDeg: -62.6795,
    distPc: 1.301,
    radiusEarth: 1.03,
    massEarth: 1.07,
    eqTempK: 234,
    periodDays: 11.186,
    discoveryYear: 2016,
    facility: "ESO HARPS",
    method: "Radial Velocity",
    planets: 3,
  },
  {
    name: "TRAPPIST-1 e",
    host: "TRAPPIST-1",
    raDeg: 346.623,
    decDeg: -5.041,
    distPc: 12.47,
    radiusEarth: 0.92,
    massEarth: 0.772,
    eqTempK: 251,
    periodDays: 6.101,
    discoveryYear: 2017,
    facility: "Spitzer",
    method: "Transit",
    planets: 7,
  },
  {
    name: "Kepler-186 f",
    host: "Kepler-186",
    raDeg: 298.475,
    decDeg: 43.955,
    distPc: 177.6,
    radiusEarth: 1.17,
    eqTempK: 188,
    periodDays: 129.9,
    discoveryYear: 2014,
    facility: "Kepler",
    method: "Transit",
    planets: 5,
  },
  {
    name: "K2-18 b",
    host: "K2-18",
    raDeg: 172.55,
    decDeg: 7.59,
    distPc: 38.0,
    radiusEarth: 2.61,
    massEarth: 8.6,
    eqTempK: 284,
    periodDays: 32.94,
    discoveryYear: 2015,
    facility: "Kepler/K2",
    method: "Transit",
    planets: 2,
  },
  {
    name: "TOI-700 d",
    host: "TOI-700",
    raDeg: 97.09,
    decDeg: -65.58,
    distPc: 31.1,
    radiusEarth: 1.19,
    massEarth: 1.72,
    eqTempK: 269,
    periodDays: 37.43,
    discoveryYear: 2020,
    facility: "TESS",
    method: "Transit",
    planets: 3,
  },
]

interface LocalImage {
  file: string
  title: string
  date: string
  center: string
  caption: string
}

export const LOCAL_IMAGES: Record<string, LocalImage> = {
  earthrise: {
    file: "/nasa/earthrise.jpg",
    title: "Earthrise",
    date: "1968-12-24",
    center: "NASA / Apollo 8",
    caption:
      "The first crewed photograph of Earth rising above the lunar horizon, taken by William Anders during Apollo 8.",
  },
  perseverance: {
    file: "/nasa/perseverance.jpg",
    title: "Perseverance Selfie with Ingenuity",
    date: "2021-04-06",
    center: "NASA / JPL-Caltech",
    caption:
      "NASA's Perseverance rover and the Ingenuity helicopter on the surface of Jezero Crater, Mars.",
  },
  pillars: {
    file: "/nasa/pillars.jpg",
    title: "Pillars of Creation",
    date: "2014-01-17",
    center: "NASA / ESA / Hubble",
    caption:
      "Hubble's visible-light view of the Pillars of Creation in the Eagle Nebula, M16.",
  },
  andromeda: {
    file: "/nasa/andromeda.jpg",
    title: "Andromeda Galaxy",
    date: "2005-07-21",
    center: "NASA / JPL-Caltech",
    caption:
      "The Andromeda Galaxy, M31, the nearest large spiral galaxy to the Milky Way.",
  },
  sun: {
    file: "/nasa/sun.jpg",
    title: "Solar Flare",
    date: "2017-09-06",
    center: "NASA / SDO",
    caption:
      "NASA's Solar Dynamics Observatory captured a powerful solar flare, seen here in extreme ultraviolet light.",
  },
  iss: {
    file: "/nasa/iss.jpg",
    title: "ISS and Earth's Horizon at Night",
    date: "2011-05-23",
    center: "NASA / Expedition 27",
    caption:
      "The International Space Station and Earth's airglow horizon photographed from orbit at night.",
  },
  voyager: {
    file: "/nasa/voyager.jpg",
    title: "Voyager Spacecraft",
    date: "1977-08-20",
    center: "NASA / JPL",
    caption:
      "An artist's concept of a Voyager spacecraft, now exploring interstellar space.",
  },
  "orion-nebula": {
    file: "/nasa/orion-nebula.jpg",
    title: "Orion Nebula",
    date: "2006-01-11",
    center: "NASA / JPL-Caltech",
    caption:
      "The Orion Nebula, M42, a nearby stellar nursery observed by the Spitzer Space Telescope.",
  },
  carina: {
    file: "/nasa/carina.jpg",
    title: "Cosmic Cliffs in Carina",
    date: "2022-07-12",
    center: "NASA / ESA / CSA / STScI",
    caption:
      "JWST's NIRCam image of the Cosmic Cliffs, a star-forming region in the Carina Nebula.",
  },
  "milky-way": {
    file: "/nasa/milky-way.jpg",
    title: "The Milky Way's Centre",
    date: "2009-11-10",
    center: "NASA / JPL-Caltech",
    caption:
      "A panorama of the galactic centre from the Spitzer Space Telescope, showing dense stars and dust lanes.",
  },
  triangulum: {
    file: "/nasa/triangulum.jpg",
    title: "Triangulum Galaxy",
    date: "2005-10-01",
    center: "NASA / JPL-Caltech",
    caption: "The Triangulum Galaxy, M33, the third-largest galaxy in the Local Group.",
  },
  virgo: {
    file: "/nasa/virgo.jpg",
    title: "Virgo Galaxy Cluster",
    date: "2005-10-01",
    center: "NASA / JPL-Caltech",
    caption:
      "The Virgo Cluster, the nearest large galaxy cluster and the gravitational centre of our local supercluster.",
  },
  crab: {
    file: "/nasa/crab.jpg",
    title: "Crab Nebula",
    date: "2005-12-01",
    center: "NASA / ESA / Hubble",
    caption:
      "The Crab Nebula, M1, the remnant of a supernova recorded in 1054 AD.",
  },
  eagle: {
    file: "/nasa/eagle.jpg",
    title: "Eagle Nebula",
    date: "2005-11-01",
    center: "NASA / ESA / Hubble",
    caption:
      "The Eagle Nebula, M16, home to the Pillars of Creation.",
  },
  cmb: {
    file: "/nasa/cmb.jpg",
    title: "The Cosmic Microwave Background",
    date: "2013-03-21",
    center: "ESA / Planck Collaboration",
    caption:
      "Planck's map of the cosmic microwave background, the oldest light in the universe.",
  },
}

export function localImage(key: string): NasaImage | null {
  const img = LOCAL_IMAGES[key]
  if (!img) return null
  return {
    id: `local-${key}`,
    title: img.title,
    date: img.date,
    center: img.center,
    caption: img.caption,
    thumb: img.file,
    full: img.file,
    local: img.file,
    source: "cached",
  }
}

const FALLBACK_KEYS = [
  "earthrise",
  "perseverance",
  "pillars",
  "andromeda",
  "sun",
  "iss",
  "voyager",
  "orion-nebula",
  "carina",
  "milky-way",
  "crab",
  "eagle",
  "cmb",
  "triangulum",
  "virgo",
]

export function fallbackImagesFor(bodyFallback?: string, query?: string): NasaImage[] {
  const out: NasaImage[] = []
  if (bodyFallback) {
    const key = bodyFallback.replace("/nasa/", "").replace(".jpg", "")
    const img = localImage(key)
    if (img) out.push(img)
  }
  const q = (query ?? "").toLowerCase()
  const preferred = FALLBACK_KEYS.filter((k) => q.includes(k) || k.includes(q))
  for (const key of [...preferred, ...FALLBACK_KEYS]) {
    const img = localImage(key)
    if (img && !out.some((o) => o.id === img.id)) out.push(img)
    if (out.length >= 4) break
  }
  return out
}
