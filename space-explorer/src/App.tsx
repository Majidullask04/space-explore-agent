import { useCallback, useRef, useState } from "react"
import SceneCanvas from "./components/SceneCanvas"
import MinimalHUD, { type HudInfo } from "./components/HUD/MinimalHUD"
import FactCard from "./components/HUD/FactCard"
import { useGeolocation } from "./hooks/useGeolocation"
import { CosmicEngine, type EngineInfo } from "./engine/CosmicEngine"
import { LOG_MIN } from "./engine/scaleController"

declare global {
  interface Window {
    __engine?: CosmicEngine
  }
}

export default function App() {
  const { origin, geo } = useGeolocation()
  const engineRef = useRef<CosmicEngine | null>(null)

  const [hudInfo, setHudInfo] = useState<HudInfo>({
    logDist: LOG_MIN,
    regionName: "Earth Surface",
    distanceLabel: "100 m",
    lightTimeLabel: "0.33 µs",
    hudDim: false,
    targetId: null,
  })

  const [selectedBody, setSelectedBody] = useState<string | null>(null)

  const onReady = useCallback(
    (engine: CosmicEngine) => {
      engineRef.current = engine
      window.__engine = engine
      engine.setOrigin({
        lat: origin.lat,
        lng: origin.lng,
        label: geo.label || "Observer Location",
        source: "geolocation",
      })
    },
    [origin.lat, origin.lng, geo.label],
  )

  const handleFrame = useCallback((info: EngineInfo) => {
    setHudInfo({
      logDist: info.logDist,
      regionName: info.regionName,
      distanceLabel: info.distanceLabel,
      lightTimeLabel: info.lightTimeLabel,
      hudDim: info.hudDim,
      targetId: info.targetId,
    })
  }, [])

  const handleScrubLogDist = useCallback((logDist: number) => {
    engineRef.current?.setLogDist(logDist)
  }, [])

  const handleTargetFocus = useCallback((id: string | null) => {
    setSelectedBody(id)
  }, [])

  return (
    <div className="app">
      <SceneCanvas
        origin={origin}
        onReady={onReady}
        onFrame={handleFrame}
        onTargetFocus={handleTargetFocus}
      />
      <MinimalHUD info={hudInfo} onScrubLogDist={handleScrubLogDist} />
      {selectedBody && <FactCard bodyId={selectedBody} onClose={() => setSelectedBody(null)} />}
    </div>
  )
}
