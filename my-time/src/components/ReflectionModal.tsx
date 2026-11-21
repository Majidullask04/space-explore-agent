import { useEffect, useRef, useState } from "react"
import { REFLECTION_FIELDS, STORAGE_KEY, type ReflectionAnswers } from "../story"

type Props = {
  open: boolean
  onClose: () => void
}

const EMPTY: ReflectionAnswers = { experience: "", build: "", postponing: "", begin: "" }

export default function ReflectionModal({ open, onClose }: Props) {
  const [answers, setAnswers] = useState<ReflectionAnswers>(EMPTY)
  const [savedNote, setSavedNote] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { answers: ReflectionAnswers }
        if (saved.answers) setAnswers({ ...EMPTY, ...saved.answers })
      }
    } catch {
      /* corrupted storage: start fresh */
    }
    panelRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      ;(triggerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const set = (id: keyof ReflectionAnswers, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, savedAt: Date.now() }))
    } catch {
      setSavedNote("This browser blocks local storage — your reflections live only in this moment.")
      return
    }
    setSavedNote("Saved. They will be waiting here when you return.")
  }

  const clear = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* nothing to clear */
    }
    setAnswers(EMPTY)
    setSavedNote("Cleared.")
  }

  return (
    <div className="veil" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflection-heading"
        ref={panelRef}
      >
        <h2 className="panel-heading" id="reflection-heading">
          My next chapter
        </h2>
        <p className="panel-intro">
          No one else will read these. They are a quiet starting point — kept on this device, for you.
        </p>
        <form onSubmit={(e) => e.preventDefault()}>
          {REFLECTION_FIELDS.map((field) => (
            <div key={field.id}>
              <label htmlFor={`reflect-${field.id}`}>{field.label}</label>
              <textarea
                id={`reflect-${field.id}`}
                value={answers[field.id]}
                onChange={(e) => set(field.id, e.target.value)}
                rows={3}
              />
            </div>
          ))}
          <div className="panel-footer">
            <button type="button" className="btn btn--primary" onClick={save}>
              Keep these
            </button>
            <button type="button" className="btn btn--link" onClick={onClose}>
              Back to the story
            </button>
            <button type="button" className="btn btn--link" onClick={clear}>
              Clear
            </button>
          </div>
          <p className="panel-saved" role="status">
            {savedNote}
          </p>
        </form>
      </div>
    </div>
  )
}
