export type BeatVariant = "hero" | "quiet" | "caps" | "list" | "action"

export interface Beat {
  lines: string[]
  variant: BeatVariant
  /** Longer section: an intentional pause before the next line. */
  tall?: boolean
}

export interface Chapter {
  id: string
  num: string
  title: string
  beats: Beat[]
}

export const CHAPTERS: Chapter[] = [
  {
    id: "beginning",
    num: "01",
    title: "The beginning: where am I?",
    beats: [
      { lines: ["Before everything else…"], variant: "hero" },
      { lines: ["Take a moment.", "Look around."], variant: "quiet" },
      { lines: ["Where are you?"], variant: "hero", tall: true },
    ],
  },
  {
    id: "earth",
    num: "02",
    title: "The earth: our little world",
    beats: [
      {
        lines: ["Somewhere in this infinite universe,", "there is a little planet called Earth."],
        variant: "quiet",
        tall: true,
      },
      { lines: ["Billions of lives.", "Millions of stories.", "Endless experiences."], variant: "quiet" },
      { lines: ["And somehow, you are here."], variant: "hero" },
    ],
  },
  {
    id: "my-world",
    num: "03",
    title: "This is my world",
    beats: [
      { lines: ["This is the world", "I get to experience."], variant: "hero", tall: true },
      {
        lines: [
          "Places I haven't seen.",
          "People I haven't met.",
          "Things I haven't learned.",
          "Dreams I haven't built.",
          "Stories I haven't lived.",
        ],
        variant: "list",
        tall: true,
      },
    ],
  },
  {
    id: "possibilities",
    num: "04",
    title: "The possibilities",
    beats: [
      { lines: ["Why should I limit", "my imagination?"], variant: "hero", tall: true },
      {
        lines: [
          "Exploring unfamiliar places.",
          "Learning new skills.",
          "Creating something from nothing.",
          "Building a meaningful project.",
          "Connecting with people.",
          "Discovering new ideas.",
          "Experiencing nature.",
          "Meeting real challenges.",
          "Creating a life worth remembering.",
        ],
        variant: "list",
        tall: true,
      },
      { lines: ["I can explore.", "I can experiment.", "I can create.", "I can build."], variant: "quiet" },
      { lines: ["I can become better", "than I was yesterday."], variant: "hero" },
    ],
  },
  {
    id: "my-time",
    num: "05",
    title: "My time",
    beats: [
      {
        lines: ["This is not somebody else's life.", "This is not somebody else's journey."],
        variant: "quiet",
        tall: true,
      },
      { lines: ["This is my time."], variant: "hero" },
      { lines: ["I don't need to have everything figured out.", "I just need to begin."], variant: "quiet" },
      { lines: ["I have a world to experience,", "a future to build,", "and a life to live."], variant: "quiet" },
      { lines: ["This is my opportunity", "to create something meaningful."], variant: "hero", tall: true },
    ],
  },
  {
    id: "next-chapter",
    num: "06",
    title: "The next chapter is mine",
    beats: [
      {
        lines: ["The universe is vast.", "My time is now.", "What will I build with it?"],
        variant: "caps",
        tall: true,
      },
      { lines: [], variant: "action" },
    ],
  },
]

export const REFLECTION_FIELDS = [
  { id: "experience", label: "What do I want to experience?" },
  { id: "build", label: "What do I want to build?" },
  { id: "postponing", label: "What have I been postponing?" },
  { id: "begin", label: "What is one thing I can begin today?" },
] as const

export type ReflectionAnswers = Record<(typeof REFLECTION_FIELDS)[number]["id"], string>

export const STORAGE_KEY = "my-time.reflection.v1"
