import { useEffect, useState, useCallback } from "react"

export interface IssState {
  lat: number | null
  lng: number | null
  altitudeKm: number | null
  velocityKmH: number | null
  timestamp: string
  live: boolean
  loading: boolean
}

const SIMULATED: IssState = {
  lat: 41.5,
  lng: -74.0,
  altitudeKm: 408,
  velocityKmH: 27600,
  timestamp: new Date().toISOString(),
  live: false,
  loading: false,
}

const CACHE_TTL = 60_000

export function useLiveISS() {
  const [state, setState] = useState<IssState>({
    ...SIMULATED,
    loading: true,
  })

  const refresh = useCallback(async () => {
    const cached = localStorage.getItem("iss:cache")
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.at < CACHE_TTL) {
          setState({ ...parsed.data, live: true, loading: false })
          return
        }
      } catch {
        /* ignore corrupt cache */
      }
    }

    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544", {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`iss ${res.status}`)
      const data = await res.json()
      const next: IssState = {
        lat: data.latitude,
        lng: data.longitude,
        altitudeKm: data.altitude,
        velocityKmH: data.velocity,
        timestamp: new Date().toISOString(),
        live: true,
        loading: false,
      }
      localStorage.setItem("iss:cache", JSON.stringify({ at: Date.now(), data: next }))
      setState(next)
    } catch {
      setState({ ...SIMULATED, loading: false })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { iss: state, refreshIss: refresh }
}
