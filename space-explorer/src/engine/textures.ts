import * as THREE from "three"

/**
 * Self-contained procedural canvas textures — no hotlinked external assets.
 */

export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  draw(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

export function dotTexture(): THREE.CanvasTexture {
  return canvasTexture(64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, "rgba(255,255,255,1)")
    g.addColorStop(0.35, "rgba(255,255,255,0.6)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
}

/** Procedural planet surface (e.g. Earth-like or rocky). */
export function planetTexture(baseColor: string, seed = 7, detail = 0.08): THREE.CanvasTexture {
  return canvasTexture(256, (ctx) => {
    let r = seed
    const rand = () => {
      r = (r * 16807) % 2147483647
      return (r - 1) / 2147483646
    }
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2200; i++) {
      const x = rand() * 256
      const y = rand() * 256
      const rad = 0.5 + rand() * 2.5
      const shade = 0.6 + rand() * 0.55
      ctx.fillStyle = `rgba(255,255,255,${detail * shade})`
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

export function sunTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
    g.addColorStop(0, "#fff3d6")
    g.addColorStop(0.4, "#ffc266")
    g.addColorStop(0.75, "#ff8a3c")
    g.addColorStop(1, "rgba(255,110,50,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  })
}

export function saturnRingTexture(): THREE.CanvasTexture {
  return canvasTexture(512, (ctx) => {
    for (let i = 0; i < 256; i++) {
      const inset = i / 256
      const alpha = 0.25 + 0.5 * Math.abs(Math.sin(inset * Math.PI * 12))
      const ringColor = i % 24 < 6 ? "#cbb68a" : "#a08c6a"
      ctx.fillStyle = `rgba(${parseInt(ringColor.slice(1, 3), 16)},${parseInt(ringColor.slice(3, 5), 16)},${parseInt(ringColor.slice(5, 7), 16)},${alpha.toFixed(3)})`
      ctx.fillRect(0, i, 512, 1)
    }
  })
}

export function starSpriteTexture(color: string): THREE.CanvasTexture {
  return canvasTexture(64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, color)
    g.addColorStop(0.4, color)
    g.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
}
