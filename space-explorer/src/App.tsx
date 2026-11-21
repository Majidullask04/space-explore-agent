import { useCallback, useRef, useState } from "react"
import SceneCanvas from "./components/SceneCanvas"
import TopTelemetryBar from "./components/HUD/TopTelemetryBar"
import ScaleLadder from "./components/HUD/ScaleLadder"
import Inspector from "./components/HUD/Inspector"
import CompareDrawer from "./components/HUD/CompareDrawer"
import AgentCommandDock from "./components/HUD/AgentCommandDock"
import LayerControls from "./components/HUD/LayerControls"
import { useGeolocation } from "./hooks/useGeolocation"
import { useLiveISS } from "./hooks/useLiveISS"
import { requestAgentPlan } from "./agent/executor"
import { MISSION_LIBRARY } from "./agent/types"
import type { AgentResult, LayerState } from "./agent/types"
import type { ScaleRegime, CelestialBody } from "./data/catalog/types"
import { findBody } from "./data/catalog"
import { SpaceEngine } from "./engine/SpaceEngine"

export default function App() {
  const { origin } = useGeolocation()
  const { iss, refreshIss } = useLiveISS()
  const engineRef = useRef<SpaceEngine | null>(null)

  const [regime, setRegime] = useState<ScaleRegime>("earth_map")
  const [targetId, setTargetId] = useState<string | null>(null)
  const [distanceM, setDistanceM] = useState(0)
  const [simClock, setSimClock] = useState("")
  const [trace, setTrace] = useState<AgentResult[]>([])
  const [busy, setBusy] = useState(false)
  const [layers, setLayers] = useState<LayerState>({
    orbits: true,
    labels: true,
    constellations: false,
    habitableZone: false,
    spacecraft: true,
    cosmicGrid: false,
  })
  const [compare, setCompare] = useState<{ a: CelestialBody; b: CelestialBody } | null>(null)

  const onReady = useCallback((engine: SpaceEngine) => {
    engineRef.current = engine
    engine.setOrigin(origin)
  }, [])

  const handleRegimeChange = useCallback((r: ScaleRegime) => {
    setRegime(r)
    setTargetId(null)
  }, [])

  const handleTargetFocus = useCallback((id: string | null) => {
    setTargetId(id)
  }, [])

  const handleFrame = useCallback((info: { regime: ScaleRegime; targetId: string | null; distanceM: number }) => {
    setDistanceM(info.distanceM)
    setSimClock(new Date().toLocaleTimeString("en-GB"))
  }, [])

  const setRegimeCmd = useCallback((r: ScaleRegime) => {
    engineRef.current?.setRegime(r)
  }, [])

  const flyTo = useCallback((id: string, r: ScaleRegime) => {
    engineRef.current?.flyToTarget(id, r, 1800)
  }, [])

  const handleAgentQuery = useCallback(
    async (query: string) => {
      setBusy(true)
      const plan = await requestAgentPlan(query)
      const results: AgentResult[] = []
      for (const step of plan.steps) {
        if (step.tool === "set_scale_regime") {
          const r = String(step.args.regime) as ScaleRegime
          if (Object.values(regimesList).includes(r)) {
            setRegimeCmd(r)
            results.push({ tool: "set_scale_regime", ok: true, summary: `Scale → ${r}`, args: step.args })
          } else {
            results.push({ tool: "set_scale_regime", ok: false, summary: `Unknown regime ${r}`, args: step.args })
          }
        } else if (step.tool === "fly_to_target") {
          const id = String(step.args.targetId)
          const r = String(step.args.regime) as ScaleRegime
          flyTo(id, r)
          results.push({ tool: "fly_to_target", ok: true, summary: `Flying to ${id}`, args: step.args })
        } else if (step.tool === "run_mission_tour") {
          const key = String(step.args.missionKey)
          const mission = MISSION_LIBRARY[key]
          if (mission) {
            for (const stop of mission.stops) {
              flyTo(stop.id, stop.regime)
              await new Promise((res) => setTimeout(res, 1600))
            }
            results.push({ tool: "run_mission_tour", ok: true, summary: `Mission: ${mission.label}`, args: step.args })
          }
        } else if (step.tool === "compare_bodies") {
          const a = findBody(String(step.args.a))
          const b = findBody(String(step.args.b))
          if (a && b) {
            setCompare({ a, b })
            results.push({ tool: "compare_bodies", ok: true, summary: `Comparing ${a.name} vs ${b.name}`, args: step.args })
          }
        } else if (step.tool === "fetch_live_iss") {
          await refreshIss()
          results.push({
            tool: "fetch_live_iss",
            ok: true,
            summary: `ISS ${iss.lat?.toFixed(2)}°, ${iss.lng?.toFixed(2)}° · ${iss.altitudeKm} km · ${iss.velocityKmH} km/h`,
            args: step.args,
          })
        } else if (step.tool === "toggle_layers") {
          const key = String(step.args.layer) as keyof LayerState
          setLayers((s) => ({ ...s, [key]: !s[key] }))
          results.push({ tool: "toggle_layers", ok: true, summary: `Toggled ${key}`, args: step.args })
        } else {
          results.push({ tool: step.tool, ok: false, summary: "Not implemented", args: step.args })
        }
      }
      setTrace((t) => [...t, ...results])
      setBusy(false)
    },
    [flyTo, setRegimeCmd, refreshIss, iss.lat, iss.lng, iss.altitudeKm, iss.velocityKmH],
  )

  const handleMission = useCallback(
    (missionKey: string) => {
      const mission = MISSION_LIBRARY[missionKey]
      if (!mission) return
      const results: AgentResult[] = []
      setBusy(true)
      const run = async () => {
        for (const stop of mission.stops) {
          flyTo(stop.id, stop.regime)
          await new Promise((res) => setTimeout(res, 1600))
        }
        results.push({ tool: "run_mission_tour", ok: true, summary: `Mission: ${mission.label}`, args: { missionKey } })
        setTrace((t) => [...t, ...results])
        setBusy(false)
      }
      void run()
    },
    [flyTo],
  )

  const targetBody = getTargetBody(targetId)

  return (
    <div className="app">
      <SceneCanvas
        origin={origin}
        onReady={onReady}
        onFrame={handleFrame}
        onRegimeChange={handleRegimeChange}
        onTargetFocus={handleTargetFocus}
      />
      <LayerControls state={layers} onToggle={(k) => setLayers((s) => ({ ...s, [k]: !s[k] }))} />
      <TopTelemetryBar regime={regime} targetName={targetBody?.name || ""} distanceM={distanceM} simClock={simClock} />
      <ScaleLadder current={regime} onSelect={setRegimeCmd} />
      {targetBody && <Inspector body={targetBody} onClose={() => setTargetId(null)} />}
      {compare && <CompareDrawer a={compare.a} b={compare.b} onClose={() => setCompare(null)} />}
      <AgentCommandDock onSubmit={handleAgentQuery} onMission={handleMission} trace={trace} busy={busy} />
    </div>
  )
}

const regimesList: string[] = [
  "earth_map",
  "earth_orbit",
  "solar_system",
  "interstellar",
  "milky_way",
  "observable_universe",
]

function getTargetBody(targetId: string | null): CelestialBody | null {
  return targetId ? findBody(targetId) ?? null : null
}
