import type { ScaleRegime } from "../../data/catalog/types"
import { formatDistance, lightTravelLabel } from "../../data/catalog/units"

interface Props {
  regime: ScaleRegime
  targetName: string
  distanceM: number
  simClock: string
}

export default function TopTelemetryBar({ regime, targetName, distanceM, simClock }: Props) {
  const dist = formatDistance(distanceM)
  return (
    <div className="hud-panel top-telemetry">
      <div className="tele-cell">
        <span className="eyebrow">Scale</span>
        <span className="mono tele-value accent">{regime.replaceAll("_", " ")}</span>
      </div>
      <div className="tele-cell">
        <span className="eyebrow">Target</span>
        <span className="mono tele-value">{targetName || "—"}</span>
      </div>
      <div className="tele-cell">
        <span className="eyebrow">Distance</span>
        <span className="mono tele-value">{dist.raw}</span>
      </div>
      <div className="tele-cell">
        <span className="eyebrow">Light-time</span>
        <span className="mono tele-value">{lightTravelLabel(distanceM)}</span>
      </div>
      <div className="tele-cell">
        <span className="eyebrow">Sim clock</span>
        <span className="mono tele-value">{simClock}</span>
      </div>
    </div>
  )
}
