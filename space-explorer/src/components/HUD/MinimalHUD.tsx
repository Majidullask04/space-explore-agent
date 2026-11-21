import { useCallback, useRef } from "react"
import { LOG_MAX, LOG_MIN } from "../../engine/scaleController"

export interface HudInfo {
  logDist: number
  regionName: string
  distanceLabel: string
  lightTimeLabel: string
  hudDim: boolean
  targetId: string | null
}

interface Props {
  info: HudInfo
  onScrubLogDist?: (logDist: number) => void
}

const DEPTH_TICKS = [
  { label: "Earth", log: 2.2 },
  { label: "Orbit", log: 6.2 },
  { label: "Solar System", log: 10.5 },
  { label: "Stars", log: 16.6 },
  { label: "Milky Way", log: 20.2 },
  { label: "Universe", log: 26.5 },
]

export default function MinimalHUD({ info, onScrubLogDist }: Props) {
  const scrubberRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Fraction from 0 (Earth at LOG_MIN) to 1 (Universe at LOG_MAX)
  const fraction = Math.max(0, Math.min(1, (info.logDist - LOG_MIN) / (LOG_MAX - LOG_MIN)))

  const updateFromPointer = useCallback(
    (clientY: number) => {
      const el = scrubberRef.current
      if (!el || !onScrubLogDist) return
      const rect = el.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      const targetLog = LOG_MIN + t * (LOG_MAX - LOG_MIN)
      onScrubLogDist(targetLog)
    },
    [onScrubLogDist],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore synthetic pointer in tests
    }
    updateFromPointer(e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    updateFromPointer(e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  return (
    <div className={`minimal-hud${info.hudDim ? " is-dimmed" : ""}`}>
      {/* Top-left typographic readout (no box, no border, no background) */}
      <div className="top-readout">
        <div className="top-readout-region">{info.regionName}</div>
        <div className="top-readout-telemetry">
          <div className="top-tele-cell">
            <span className="top-tele-label">Distance</span>
            <span className="top-tele-value">{info.distanceLabel}</span>
          </div>
          <div className="top-tele-divider" />
          <div className="top-tele-cell">
            <span className="top-tele-label">Light-Time</span>
            <span className="top-tele-value">{info.lightTimeLabel}</span>
          </div>
        </div>
      </div>

      {/* Far-right hairline depth scrubber (2px vertical line) */}
      <div
        ref={scrubberRef}
        className="depth-scrubber"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Cosmic depth scrubber"
      >
        <div className="depth-track">
          <div className="depth-cursor" style={{ top: `${(fraction * 100).toFixed(2)}%` }} />
        </div>

        <div className="depth-ticks">
          {DEPTH_TICKS.map((tick) => {
            const tickFraction = (tick.log - LOG_MIN) / (LOG_MAX - LOG_MIN)
            const isActive = Math.abs(fraction - tickFraction) < 0.08
            return (
              <div
                key={tick.label}
                className={`depth-tick${isActive ? " is-active" : ""}`}
                style={{ top: `${(tickFraction * 100).toFixed(2)}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  onScrubLogDist?.(tick.log)
                }}
              >
                <span className="depth-tick-label">{tick.label}</span>
                <span className="depth-tick-line" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
