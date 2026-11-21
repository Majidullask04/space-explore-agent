import { useState } from "react"
import type { LayerState } from "../../agent/types"

interface Props {
  state: LayerState
  onToggle: (key: keyof LayerState) => void
}

const LAYERS: { key: keyof LayerState; label: string }[] = [
  { key: "orbits", label: "Orbits" },
  { key: "labels", label: "Labels" },
  { key: "constellations", label: "Constellations" },
  { key: "spacecraft", label: "Spacecraft" },
  { key: "grid", label: "Cosmic Grid" },
]

export default function LayerControls({ state, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="layer-controls">
      <button className="hud-panel layer-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle layers">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M7 1l6 3-6 3-6-3zM1 7l6 3 6-3M1 10l6 3 6-3" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open && (
        <div className="hud-panel layer-menu">
          {LAYERS.map((l) => (
            <label key={l.key} className="layer-option">
              <input type="checkbox" checked={state[l.key]} onChange={() => onToggle(l.key)} />
              <span className="mono">{l.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
