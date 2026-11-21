import { useEffect, useRef, useState } from "react"

/**
 * Ambient space drone synthesized with the Web Audio API — no audio files,
 * nothing to download, and it only ever starts on an explicit user click.
 */
function createAmbience() {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let running = false

  const start = () => {
    if (running) return
    running = true
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 4)

    // deep detuned foundation
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = "lowpass"
    lowpass.frequency.value = 240
    lowpass.connect(master)

    const freqs = [55, 110.4, 164.8]
    freqs.forEach((f, i) => {
      const osc = ctx!.createOscillator()
      osc.type = i === 2 ? "triangle" : "sine"
      osc.frequency.value = f
      const gain = ctx!.createGain()
      gain.gain.value = i === 2 ? 0.05 : 0.22
      osc.connect(gain).connect(lowpass)
      osc.start()
    })

    // slow-breathing filtered noise, like distant wind
    const seconds = 4
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const bandpass = ctx.createBiquadFilter()
    bandpass.type = "bandpass"
    bandpass.frequency.value = 700
    bandpass.Q.value = 0.6
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.012
    noise.connect(bandpass).connect(noiseGain).connect(master)
    noise.start()

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 320
    lfo.connect(lfoGain).connect(bandpass.frequency)
    lfo.start()
  }

  const stop = () => {
    if (!running || !ctx || !master) return
    running = false
    const current = ctx
    master.gain.linearRampToValueAtTime(0.0001, current.currentTime + 1.2)
    window.setTimeout(() => void current.close(), 1400)
    ctx = null
    master = null
  }

  return { start, stop }
}

export default function SoundToggle() {
  const [on, setOn] = useState(false)
  const ambience = useRef(createAmbience())

  useEffect(() => () => ambience.current.stop(), [])

  const toggle = () => {
    if (on) {
      ambience.current.stop()
      setOn(false)
    } else {
      ambience.current.start()
      setOn(true)
    }
  }

  return (
    <button type="button" className="sound" onClick={toggle} aria-pressed={on}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        {on ? (
          <>
            <path d="M2 6v4h2.5L8 13V3L4.5 6H2z" strokeLinejoin="round" />
            <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" strokeLinecap="round" />
            <path d="M12.2 3.8a6 6 0 0 1 0 8.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M2 6v4h2.5L8 13V3L4.5 6H2z" strokeLinejoin="round" />
            <path d="M10.5 6l4 4M14.5 6l-4 4" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className="sound-label">{on ? "Sound on" : "Sound off"}</span>
    </button>
  )
}
