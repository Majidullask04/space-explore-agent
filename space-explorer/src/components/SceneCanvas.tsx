import { useEffect, useRef } from "react"
import { CosmicEngine, type EngineOptions } from "../engine/CosmicEngine"
import type { ScaleRegime } from "../data/catalog/types"
import { DEFAULT_LAYERS } from "../engine/CosmicEngine"

interface SceneCanvasProps {
  origin: { lat: number; lng: number }
  onReady?: (engine: CosmicEngine) => void
  onFrame?: (info: {
    regime: ScaleRegime
    targetId: string | null
    cameraDistance: number
    scaleDistance: number
    scaleUnit: "km" | "AU" | "ly" | "Mly" | "Gly"
    simDate: number
    timeWarp: number
    surfaceSource: "gibs" | "fallback" | "none"
  }) => void
  onRegimeChange?: (regime: ScaleRegime) => void
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

    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [origin.lat, origin.lng, onReady, onFrame, onRegimeChange, onTargetFocus])

  return <div ref={hostRef} className="scene-canvas" style={{ position: "absolute", inset: 0 }} />
}