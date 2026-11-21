import type { CelestialBody } from "../../data/catalog/types"
import { formatDistance, lightTravelLabel } from "../../data/catalog/units"

interface Props {
  a: CelestialBody
  b: CelestialBody
  onClose: () => void
}

export default function CompareDrawer({ a, b, onClose }: Props) {
  const rows = [
    { label: "Radius", a: formatDistance(a.profile.radiusM).raw, b: formatDistance(b.profile.radiusM).raw },
    { label: "Mass", a: `${a.profile.massKg.toExponential(2)} kg`, b: `${b.profile.massKg.toExponential(2)} kg` },
    { label: "Surface gravity", a: `${a.profile.surfaceG.toFixed(2)} m/s²`, b: `${b.profile.surfaceG.toFixed(2)} m/s²` },
    { label: "Mean temp", a: `${a.profile.meanTempK} K`, b: `${b.profile.meanTempK} K` },
    { label: "Rotation", a: `${Math.abs(a.profile.rotationHours).toFixed(1)} h`, b: `${Math.abs(b.profile.rotationHours).toFixed(1)} h` },
    { label: "Distance from Earth", a: formatDistance(a.distFromEarthM).raw, b: formatDistance(b.distFromEarthM).raw },
    { label: "Light-travel time", a: lightTravelLabel(a.distFromEarthM), b: lightTravelLabel(b.distFromEarthM) },
  ]

  return (
    <div className="hud-panel compare-drawer">
      <div className="inspector-head">
        <span className="eyebrow">Body Comparison</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close comparison">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </div>
      <div className="compare-heads">
        <span className="mono compare-name">{a.name}</span>
        <span className="mono compare-name">{b.name}</span>
      </div>
      <table className="compare-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="eyebrow">{r.label}</td>
              <td className="mono">{r.a}</td>
              <td className="mono">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
