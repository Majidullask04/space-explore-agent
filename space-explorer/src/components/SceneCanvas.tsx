import { useEffect, useRef } from "react"
import { SpaceEngine, type EngineCallbacks } from "../engine/SpaceEngine"

interface Props extends EngineCallbacks {
  origin: { lat: number; lng: number }
  onReady?: (engine: SpaceEngine) => void
}

export default function SceneCanvas({ origin, onFrame, onRegimeChange, onTargetFocus, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<SpaceEngine | null>(null)
  const cbRef = useRef<EngineCallbacks>({})
  cbRef.current = { onFrame, onRegimeChange, onTargetFocus }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const engine = new SpaceEngine(host, origin, {
      onFrame: (info) => cbRef.current.onFrame?.(info),
      onRegimeChange: (r) => cbRef.current.onRegimeChange?.(r),
      onTargetFocus: (id) => cbRef.current.onTargetFocus?.(id),
    })
    engineRef.current = engine
    onReady?.(engine)
    return () => {
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng])

  return <div ref={hostRef} className="scene-canvas" style={{ position: "absolute", inset: 0 }} />
}
