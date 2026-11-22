import { useEffect, useRef } from "react"
import { CosmicEngine, type EngineInfo, type EngineOptions } from "../engine/CosmicEngine"
import type { RegimeId } from "../data/types"
import { DEFAULT_LAYERS } from "../engine/CosmicEngine"
import { loadStars } from "../lib/stars"
import { fetchExoplanets, fetchIss } from "../lib/api"

interface SceneCanvasProps {
  origin: { lat: number; lng: number }
  onReady?: (engine: CosmicEngine) => void
  onFrame?: (info: EngineInfo) => void
  onRegimeChange?: (regime: RegimeId) => void
  onTargetFocus?: (id: string | null) => void
}

export default function SceneCanvas({
  origin,
  onReady,
  onFrame,
  onRegimeChange,
  onTargetFocus,
}: SceneCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<CosmicEngine | null>(null)

  const callbacksRef = useRef({ onReady, onFrame, onRegimeChange, onTargetFocus })
  useEffect(() => {
    callbacksRef.current = { onReady, onFrame, onRegimeChange, onTargetFocus }
  })

  // Initialize engine once on mount
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const engineOptions: EngineOptions = {
      stars: [],
      origin: {
        lat: origin.lat,
        lng: origin.lng,
        label: "Manual",
        source: "geolocation",
      },
      iss: null,
      exoplanets: [],
      layers: DEFAULT_LAYERS,
    }

    const engine = new CosmicEngine(host, engineOptions, {
      onFrame: (info) => callbacksRef.current.onFrame?.(info),
      onRegimeChange: (r) => callbacksRef.current.onRegimeChange?.(r),
      onTargetFocus: (id) => callbacksRef.current.onTargetFocus?.(id),
    })

    engineRef.current = engine
    callbacksRef.current.onReady?.(engine)

    // Load Hipparcos/HYG stars in background
    loadStars()
      .then((stars) => {
        engine.setStars(stars)
      })
      .catch(() => {
        // Fallback procedural stars already generated
      })

    // Live ISS position, refreshed well inside the API rate limit.
    let issTimer = 0
    const refreshIss = () => {
      void fetchIss().then((state) => {
        if (!engineRef.current) return
        engine.setIss(state)
      })
    }
    refreshIss()
    issTimer = window.setInterval(refreshIss, 10_000)

    // Confirmed exoplanets from the NASA Exoplanet Archive.
    void fetchExoplanets().then((list) => {
      if (engineRef.current) engine.setExoplanets(list)
    })

    return () => {
      window.clearInterval(issTimer)
      engine.dispose()
      engineRef.current = null
    }
  }, []) // Mount once — never tear down WebGL on state changes

  // Update origin dynamically without recreating engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setOrigin({
        lat: origin.lat,
        lng: origin.lng,
        label: "Observer Location",
        source: "geolocation",
      })
    }
  }, [origin.lat, origin.lng])

  return <div ref={hostRef} className="scene-canvas" style={{ position: "absolute", inset: 0 }} />
}
