import { useEffect, useState } from "react"

export interface GeoState {
  lat: number | null
  lng: number | null
  status: "idle" | "requesting" | "ok" | "denied" | "error"
  label: string
}

const FALLBACK = { lat: 12.9716, lng: 77.5946, label: "Bengaluru, India" }

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    status: "idle",
    label: "Requesting location…",
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ ...FALLBACK, status: "denied", label: "Geolocation unsupported — using fallback" })
      return
    }
    setState((s) => ({ ...s, status: "requesting" }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          status: "ok",
          label: `Lat ${pos.coords.latitude.toFixed(4)}°, Lon ${pos.coords.longitude.toFixed(4)}°`,
        })
      },
      (err) => {
        setState({
          ...FALLBACK,
          status: err.code === err.PERMISSION_DENIED ? "denied" : "error",
          label: err.code === err.PERMISSION_DENIED ? "Location permission denied — using fallback" : "Location unavailable — using fallback",
        })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }, [])

  return {
    geo: state,
    origin: { lat: state.lat ?? FALLBACK.lat, lng: state.lng ?? FALLBACK.lng },
  }
}
