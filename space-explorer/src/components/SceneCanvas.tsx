import { useEffect, useRef } from "react"
import { CosmicEngine, type EngineInfo, type EngineOptions } from "../engine/CosmicEngine"
import type { RegimeId } from "../data/types"
import { DEFAULT_LAYERS } from "../engine/CosmicEngine"
import { loadStars } from "../lib/stars"

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
      onFrame: (info) => onFrame?.(info),
      onRegimeChange: (r) => onRegimeChange?.(r),
      onTargetFocus: (id) => onTargetFocus?.(id),
    })

    engineRef.current = engine
    onReady?.(engine)

    // Load Hipparcos/HYG stars in background
    loadStars()
      .then((stars) => {
        engine.setStars(stars)
      })
      .catch(() => {
        // Fallback procedural stars already generated
      })

    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [origin.lat, origin.lng, onReady, onFrame, onRegimeChange, onTargetFocus])

  return <div ref={hostRef} className="scene-canvas" style={{ position: "absolute", inset: 0 }} />
}