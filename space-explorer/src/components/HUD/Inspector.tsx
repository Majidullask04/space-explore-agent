import type { CelestialBody } from "../../data/catalog/types"
import { formatDistance, lightTravelLabel } from "../../data/catalog/units"

interface Props {
  body: CelestialBody | null
  onClose: () => void
}

export default function Inspector({ body, onClose }: Props) {
  if (!body) return null
  const p = body.profile
  return (
    <div className="hud-panel inspector">
      <div className="inspector-head">
        <span className="eyebrow">Inspector</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close inspector">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </div>
      <h2 className="inspector-name">{body.name}</h2>
      <p className="inspector-desc">{body.description}</p>
      <div className="inspector-grid">
        <Fact label="Radius" value={formatDistance(p.radiusM).raw} />
        <Fact label="Mass" value={`${p.massKg.toExponential(2)} kg`} />
        <Fact label="Surface gravity" value={`${p.surfaceG.toFixed(2)} m/s²`} />
        <Fact label="Mean temp" value={`${p.meanTempK} K`} />
        <Fact label="Albedo" value={p.albedo.toFixed(2)} />
        <Fact label="Rotation" value={`${Math.abs(p.rotationHours).toFixed(1)} h`} />
        <Fact label="Distance from Earth" value={formatDistance(body.distFromEarthM).raw} />
        <Fact label="Light-travel time" value={lightTravelLabel(body.distFromEarthM)} />
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span className="eyebrow">{label}</span>
      <span className="mono fact-value">{value}</span>
    </div>
  )
}
