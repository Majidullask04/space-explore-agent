import type { StarRecord } from "../data/types"

interface StarFile {
  stars: Array<[number, number, number, number, number, string]>
}

let cache: StarRecord[] | null = null
let pending: Promise<StarRecord[]> | null = null

export function loadStars(): Promise<StarRecord[]> {
  if (cache) return Promise.resolve(cache)
  if (pending) return pending
  pending = fetch("/data/stars.json")
    .then((res) => {
      if (!res.ok) throw new Error(`stars ${res.status}`)
      return res.json() as Promise<StarFile>
    })
    .then((data) => {
      // The catalog stores right ascension in hours; the renderer expects degrees.
      cache = data.stars.map(([raHours, decDeg, mag, bv, distPc, name]) => ({
        raDeg: raHours * 15,
        decDeg,
        mag,
        bv,
        distPc,
        name: name || undefined,
      }))
      return cache
    })
    .catch(() => {
      cache = []
      return cache
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export function starsWithinLy(stars: StarRecord[], lightYears: number): StarRecord[] {
  const pc = lightYears / 3.26156
  return stars.filter((s) => s.distPc > 0 && s.distPc <= pc)
}

export function namedStars(stars: StarRecord[]): StarRecord[] {
  return stars.filter((s) => s.name)
}
