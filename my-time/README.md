# MY TIME — A Universe of Possibilities

An immersive, scroll-driven cinematic story. You begin alone in the dark of space,
watch stars appear, drift toward a living Earth, hold it close, travel through what
your one life could hold, and end at sunrise with a question — and a place to answer it.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview
```

## The journey

| Chapter | What happens |
| --- | --- |
| 01 · The Beginning | Darkness. Stars fade in. "Where are you?" |
| 02 · The Earth | A living planet approaches: oceans, clouds, atmosphere, sunlight. |
| 03 · This Is My World | The Earth fills the screen — a world held close. |
| 04 · The Possibilities | The planet recedes; nine possibilities drift past. |
| 05 · My Time | The lines land one by one. "This is MY TIME." |
| 06 · The Next Chapter Is Mine | Sunrise over the limb, then a reflection you keep. |

## How it is built

- **React + TypeScript + Vite**, plain **Three.js** (code-split, lazy-loaded; the story
  text paints instantly while the cosmos streams in).
- The Earth uses NASA-derived imagery from the three.js repository (MIT) — surface,
  normals, specular oceans — plus a cloud layer with its own alpha, a fresnel
  atmosphere shader, and a keyframed sun that ends as a warm sunrise on the limb.
- **Scroll choreography**: one scroll progress value drives camera distance, the
  planet's presence, the sun's warmth, and the starfield's slow parallax; text beats
  reveal with transform-only motion (never hidden from a failed script, respects
  `prefers-reduced-motion`).
- **Ambient sound** is synthesized live with the Web Audio API — no audio files,
  nothing autoplays, one clearly labelled control.
- **Reflections** (what to experience, build, begin) persist in `localStorage`.
- Graceful CSS fallback if WebGL is unavailable; responsive from 375px up; keyboard
  focus, reduced-motion and screen-reader labels handled.

## Reflections

Answers are saved only on your device under the key `my-time.reflection.v1`.
The Clear button in the reflection panel removes them.
