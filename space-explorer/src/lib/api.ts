import type {
  AsteroidRecord,
  ExoplanetRecord,
  FlareRecord,
  IssState,
  NasaImage,
} from "../data/types"
import {
  ASTEROID_SNAPSHOT,
  EXOPLANET_SNAPSHOT,
  FLARE_SNAPSHOT,
  ISS_SNAPSHOT,
  fallbackImagesFor,
} from "../data/snapshots"

const MEMORY = new Map<string, { expires: number; value: unknown }>()

function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { expires: number; value: T }
    if (parsed.expires < Date.now()) return null
    return parsed.value
  } catch {
    return null
  }
}

function storageSet(key: string, value: unknown, ttl: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ expires: Date.now() + ttl, value }))
  } catch {
    // quota or private mode
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function getJson<T>(url: string, ms = 12_000): Promise<T> {
  const res = await fetchWithTimeout(url, {}, ms)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return (await res.json()) as T
}

function cachedFetch<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const mem = MEMORY.get(key)
  if (mem && mem.expires > Date.now()) return Promise.resolve(mem.value as T)
  const stored = storageGet<T>(key)
  if (stored) {
    MEMORY.set(key, { expires: Date.now() + ttl, value: stored })
    return Promise.resolve(stored)
  }
  return loader().then((value) => {
    MEMORY.set(key, { expires: Date.now() + ttl, value })
    storageSet(key, value, ttl)
    return value
  })
}

export async function fetchIss(): Promise<IssState> {
  try {
    return await cachedFetch<IssState>("space:iss", 4_000, () => getJson<IssState>("/api/nasa/iss", 8_000))
  } catch {
    return { ...ISS_SNAPSHOT, timestamp: Date.now(), source: "cached" }
  }
}

export async function fetchFlares(): Promise<FlareRecord[]> {
  try {
    const data = await cachedFetch<FlareRecord[]>("space:flares", 30 * 60_000, () =>
      getJson<FlareRecord[]>("/api/nasa/flares", 16_000),
    )
    return data.length ? data : FLARE_SNAPSHOT
  } catch {
    return FLARE_SNAPSHOT
  }
}

export async function fetchAsteroids(): Promise<AsteroidRecord[]> {
  try {
    const data = await cachedFetch<AsteroidRecord[]>("space:asteroids", 6 * 3_600_000, () =>
      getJson<AsteroidRecord[]>("/api/nasa/asteroids", 16_000),
    )
    return data.length ? data : ASTEROID_SNAPSHOT
  } catch {
    return ASTEROID_SNAPSHOT
  }
}

export async function fetchExoplanets(): Promise<ExoplanetRecord[]> {
  try {
    const data = await cachedFetch<ExoplanetRecord[]>("space:exoplanets", 24 * 3_600_000, () =>
      getJson<ExoplanetRecord[]>("/api/nasa/exoplanets?limit=500", 22_000),
    )
    return data.length ? data : EXOPLANET_SNAPSHOT
  } catch {
    return EXOPLANET_SNAPSHOT
  }
}

export async function fetchNasaImages(query: string, fallback?: string): Promise<NasaImage[]> {
  const q = query.trim() || "Earth"
  try {
    const data = await cachedFetch<NasaImage[]>(`space:images:${q.toLowerCase()}`, 24 * 3_600_000, () =>
      getJson<NasaImage[]>(`/api/nasa/images?q=${encodeURIComponent(q)}&limit=8`, 16_000),
    )
    if (data.length) return data
    return fallbackImagesFor(fallback, q)
  } catch {
    return fallbackImagesFor(fallback, q)
  }
}

export interface HorizonsVector {
  body: string
  date: string
  x: number
  y: number
  z: number
  source: "live" | "cached"
}

export async function fetchHorizons(body: string): Promise<HorizonsVector | null> {
  try {
    return await cachedFetch<HorizonsVector>(`space:horizons:${body}`, 6 * 3_600_000, () =>
      getJson<HorizonsVector>(`/api/nasa/horizons?body=${encodeURIComponent(body)}`, 22_000),
    )
  } catch {
    return null
  }
}

export interface AgentStatus {
  configured: boolean
  provider: string | null
  model: string | null
}

export async function getAgentStatus(): Promise<AgentStatus> {
  try {
    return await getJson<AgentStatus>("/api/agent/status", 3_000)
  } catch {
    return { configured: false, provider: null, model: null }
  }
}

export interface RemoteAgentPlan {
  configured: boolean
  steps: Array<{ tool: string; args: Record<string, unknown> }>
  narration: string
  provider?: string
  model?: string
  error?: string
}

export async function requestAgentPlan(query: string): Promise<RemoteAgentPlan | null> {
  try {
    const res = await fetchWithTimeout(
      "/api/agent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      },
      8_000,
    )
    if (!res.ok) return null
    return (await res.json()) as RemoteAgentPlan
  } catch {
    return null
  }
}

/** Test hook used by the headless visual QA script. */
export function clearApiCache() {
  MEMORY.clear()
}
