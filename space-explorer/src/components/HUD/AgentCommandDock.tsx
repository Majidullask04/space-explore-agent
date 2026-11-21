import { useState } from "react"
import { MISSION_LIBRARY } from "../../agent/types"
import type { AgentResult } from "../../agent/types"

interface Props {
  onSubmit: (query: string) => void
  onMission: (missionKey: string) => void
  trace: AgentResult[]
  busy: boolean
}

export default function AgentCommandDock({ onSubmit, onMission, trace, busy }: Props) {
  const [query, setQuery] = useState("")

  const submit = () => {
    const q = query.trim()
    if (!q || busy) return
    onSubmit(q)
    setQuery("")
  }

  return (
    <div className="hud-panel agent-dock">
      <div className="dock-row">
        <span className="eyebrow">Astrogation Agent</span>
        <div className="dock-input-wrap">
          <input
            className="dock-input mono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. fly to Saturn, then to Andromeda"
            aria-label="Mission command"
          />
          <button className="dock-send" onClick={submit} disabled={busy} aria-label="Send command">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 13L13 7 1 1v5l8 1-8 1z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
      <div className="dock-chips">
        {Object.entries(MISSION_LIBRARY).map(([key, m]) => (
          <button key={key} className="chip" onClick={() => onMission(key)} disabled={busy}>
            {m.label}
          </button>
        ))}
      </div>
      {trace.length > 0 && (
        <div className="dock-trace">
          {trace.map((t, i) => (
            <div key={i} className={`trace-line ${t.ok ? "is-ok" : "is-bad"}`}>
              <span className="mono trace-tool">{t.tool}</span>
              <span className="mono trace-summary">{t.summary}</span>
            </div>
          ))}
        </div>
      )}
      {busy && <div className="mono dock-busy">… piloting</div>}
    </div>
  )
}
