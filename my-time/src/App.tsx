import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import ProgressRail from "./components/ProgressRail"
import ReflectionModal from "./components/ReflectionModal"
import SoundToggle from "./components/SoundToggle"
import { CHAPTERS, type Beat } from "./story"

const CosmosCanvas = lazy(() => import("./components/CosmosCanvas"))

type Progress = {
  raw: number
  chapterRaw: number
}

export default function App() {
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  const progress = useRef<Progress>({ raw: 0, chapterRaw: 0 })
  const [chapter, setChapter] = useState(0)
  const [cueVisible, setCueVisible] = useState(true)
  const [reflectOpen, setReflectOpen] = useState(false)
  const chapterRefs = useRef<(HTMLElement | null)[]>([])
  const beatRefs = useRef<(HTMLElement | null)[]>([])
  const chapterState = useRef(-1)

  /* Scroll choreography: one pass per frame, cheap DOM reads kept inside it. */
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = requestAnimationFrame(measure)
      const doc = document.documentElement
      const max = Math.max(1, doc.scrollHeight - window.innerHeight)
      progress.current.raw = Math.min(1, Math.max(0, window.scrollY / max))

      const mid = window.innerHeight * 0.5
      let chapterRaw = 0
      chapterRefs.current.forEach((el, i) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.top <= mid && rect.bottom > mid) {
          chapterRaw = i + (mid - rect.top) / Math.max(1, rect.height)
        }
      })
      progress.current.chapterRaw = Math.min(CHAPTERS.length, Math.max(0, chapterRaw))

      const nearest = Math.min(CHAPTERS.length - 1, Math.round(progress.current.chapterRaw))
      if (nearest !== chapterState.current) {
        chapterState.current = nearest
        setChapter(nearest)
      }
      const cue = window.scrollY < window.innerHeight * 0.5
      setCueVisible((prev) => (prev === cue ? prev : cue))
    }
    measure()
    return () => cancelAnimationFrame(raf)
  }, [])

  /* Reveal beats as they cross the middle of the viewport. Anything already
     on screen at load shows instantly — no waiting for a transition. */
  useEffect(() => {
    let firstBatch = true
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) {
            if (firstBatch) {
              el.style.transition = "none"
              el.classList.add("is-in")
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  el.style.transition = ""
                }),
              )
            } else {
              el.classList.add("is-in")
            }
          } else {
            el.classList.remove("is-in")
          }
        })
        firstBatch = false
      },
      { threshold: 0.3, rootMargin: "18% 0px 18% 0px" },
    )
    beatRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const jumpTo = useCallback(
    (index: number) => {
      chapterRefs.current[index]?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
    },
    [reduced],
  )

  const replay = useCallback(() => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
  }, [reduced])

  let beatIndex = 0

  const renderBeat = (beat: Beat, chapterId: string) => {
    const index = beatIndex++
    const common = {
      className: `beat beat--${beat.variant}`,
      "data-beat": index,
      "data-tall": beat.tall ?? false,
      ref: (el: HTMLElement | null) => {
        beatRefs.current[index] = el
      },
    }

    if (beat.variant === "action") {
      return (
        <section key={`${chapterId}-${index}`} {...common}>
          <div className="beat-inner actions">
            <button type="button" className="btn btn--primary" onClick={() => setReflectOpen(true)}>
              Begin my next chapter
            </button>
            <button type="button" className="btn btn--link" onClick={replay}>
              Replay the journey
            </button>
            <p className="actions-note">Scroll back up anytime. The universe keeps still while you think.</p>
          </div>
        </section>
      )
    }

    return (
      <section key={`${chapterId}-${index}`} {...common}>
        <div className="beat-inner">
          {beat.lines.map((line, i) => (
            <p
              className={`beat-line ${beat.variant === "caps" ? "display-line" : ""}`}
              key={i}
              style={{ "--i": i } as React.CSSProperties}
            >
              {line}
            </p>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <Suspense fallback={null}>
        <CosmosCanvas progress={progress} reduced={reduced} />
      </Suspense>

      <h1 className="wordmark">
        <a href="#top" onClick={(e) => { e.preventDefault(); replay() }} aria-label="MY TIME: A Universe of Possibilities. Back to the beginning.">
          MY TIME
        </a>
      </h1>

      <ProgressRail current={chapter} onJump={jumpTo} />
      <SoundToggle />

      <button
        type="button"
        className={`scroll-cue ${cueVisible ? "is-visible" : ""}`}
        aria-label="Scroll to continue the story"
        onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: reduced ? "auto" : "smooth" })}
      >
        <span aria-hidden="true" style={{ display: "none" }} />
      </button>

      <main className="story" id="top">
        {CHAPTERS.map((chapter, i) => (
          <div
            key={chapter.id}
            ref={(el) => {
              chapterRefs.current[i] = el
            }}
          >
            {chapter.beats.map((beat) => renderBeat(beat, chapter.id))}
          </div>
        ))}
      </main>

      <ReflectionModal open={reflectOpen} onClose={() => setReflectOpen(false)} />
    </>
  )
}
