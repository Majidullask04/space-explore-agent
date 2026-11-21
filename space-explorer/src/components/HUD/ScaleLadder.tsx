import type { ScaleRegime } from "../../data/catalog/types"
import { REGIMES } from "../../data/catalog/regimes"

interface Props {
  current: ScaleRegime
  onSelect: (r: ScaleRegime) => void
}

export default function ScaleLadder({ current, onSelect }: Props) {
  return (
    <div className="hud-panel scale-ladder">
      <span className="eyebrow ladder-title">Scale Ladder</span>
      <div className="ladder-track">
        {REGIMES.map((r) => {
          const active = r.id === current
          return (
            <button
              key={r.id}
              className={`ladder-rung${active ? " is-active" : ""}`}
              onClick={() => onSelect(r.id)}
              aria-current={active ? "true" : undefined}
            >
              <span className="ladder-dot" />
              <span className="ladder-label mono">{r.label}</span>
              <span className="ladder-unit mono">{r.units}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
