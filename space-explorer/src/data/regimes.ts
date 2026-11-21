import type { RegimeId } from "./types"

export interface Regime {
  id: RegimeId
  index: number
  label: string
  short: string
  distance: string
  description: string
}

export const REGIMES: Regime[] = [
  {
    id: "surface",
    index: 0,
    label: "Surface",
    short: "SFC",
    distance: "0 km",
    description: "Your exact coordinates on the real NASA satellite mosaic.",
  },
  {
    id: "orbit",
    index: 1,
    label: "Orbit",
    short: "LEO",
    distance: "400 km",
    description: "Atmospheric ascent, the Karman line, and the live ISS.",
  },
  {
    id: "solar_system",
    index: 2,
    label: "Solar System",
    short: "SOL",
    distance: "1 AU",
    description: "The Sun and planets at their real positions for this instant.",
  },
  {
    id: "interstellar",
    index: 3,
    label: "Interstellar",
    short: "LY",
    distance: "4.24 ly",
    description: "The nearest stars and confirmed exoplanet systems in three dimensions.",
  },
  {
    id: "milky_way",
    index: 4,
    label: "Milky Way",
    short: "MW",
    distance: "105,700 ly",
    description: "The Orion Arm, the galactic centre, and real deep-sky landmarks.",
  },
  {
    id: "universe",
    index: 5,
    label: "Observable Universe",
    short: "CMB",
    distance: "93 Gly",
    description: "The Local Group, Laniakea, and the cosmic microwave horizon.",
  },
]

export const REGIME_BY_ID = Object.fromEntries(REGIMES.map((r) => [r.id, r])) as Record<
  RegimeId,
  Regime
>

export function isRegime(value: string): value is RegimeId {
  return REGIMES.some((r) => r.id === value)
}

export function nextRegime(id: RegimeId): RegimeId | null {
  const i = REGIMES.findIndex((r) => r.id === id)
  return i >= 0 && i < REGIMES.length - 1 ? REGIMES[i + 1].id : null
}

export function previousRegime(id: RegimeId): RegimeId | null {
  const i = REGIMES.findIndex((r) => r.id === id)
  return i > 0 ? REGIMES[i - 1].id : null
}
