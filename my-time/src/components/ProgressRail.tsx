import { CHAPTERS } from "../story"

type Props = {
  current: number
  onJump: (index: number) => void
}

export default function ProgressRail({ current, onJump }: Props) {
  return (
    <nav className="rail" aria-label="Chapters of the story">
      {CHAPTERS.map((chapter, i) => (
        <button
          key={chapter.id}
          type="button"
          onClick={() => onJump(i)}
          aria-current={i === current}
          aria-label={`Chapter ${chapter.num} — ${chapter.title}`}
        >
          <span className="rail-label">{chapter.title}</span>
          <span className="rail-tick" aria-hidden="true" />
        </button>
      ))}
    </nav>
  )
}
