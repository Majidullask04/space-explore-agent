import * as THREE from "three"

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

export function texture(url: string, srgb = true): THREE.Texture {
  const key = `${url}:${srgb}`
  const hit = cache.get(key)
  if (hit) return hit
  const tex = loader.load(
    url,
    (loaded) => {
      loaded.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      loaded.anisotropy = 8
      loaded.needsUpdate = true
    },
    undefined,
    () => {
      // A missing optional asset must never produce a console error loop.
    },
  )
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 8
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  cache.set(key, tex)
  return tex
}

export function disposeTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}

/* ------------------------------------------------------------------ */
/* Procedural helpers                                                  */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}

function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let value = 0
  let amp = 0.5
  let freq = 1
  let total = 0
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq, seed + i * 37)
    total += amp
    amp *= 0.5
    freq *= 2
  }
  return value / total
}

function canvasTexture(canvas: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

export function proceduralPlanetTexture(color: string, seed: number, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size / 2
  const ctx = canvas.getContext("2d")!
  const base = new THREE.Color(color)
  const img = ctx.createImageData(canvas.width, canvas.height)
  const rand = mulberry32(seed)
  const craters = Array.from({ length: 90 }, () => ({
    x: rand() * canvas.width,
    y: rand() * canvas.height,
    r: 2 + rand() * 14,
    d: 0.04 + rand() * 0.1,
  }))
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const n = fbm(x / 42, y / 42, seed, 5)
      const n2 = fbm(x / 9, y / 9, seed + 9, 3)
      let shade = 0.72 + n * 0.5 + (n2 - 0.5) * 0.16
      for (const c of craters) {
        const dx = x - c.x
        const dy = (y - c.y) * 2
        const d = Math.sqrt(dx * dx + dy * dy) / c.r
        if (d < 1.15) {
          shade += d < 0.8 ? -c.d * (1 - d) : c.d * 0.7 * (d - 0.8)
        }
      }
      const i = (y * canvas.width + x) * 4
      img.data[i] = Math.max(0, Math.min(255, base.r * 255 * shade))
      img.data[i + 1] = Math.max(0, Math.min(255, base.g * 255 * shade))
      img.data[i + 2] = Math.max(0, Math.min(255, base.b * 255 * shade))
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvasTexture(canvas)
}

export function starSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext("2d")!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.14, "rgba(255,255,255,0.96)")
  g.addColorStop(0.32, "rgba(255,255,255,0.38)")
  g.addColorStop(0.62, "rgba(255,255,255,0.07)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return canvasTexture(canvas, false)
}

export function glowSpriteTexture(color = "#ffd9a0", hard = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")!
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  const c = new THREE.Color(color)
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
  g.addColorStop(0, `rgba(${rgb},1)`)
  g.addColorStop(hard ? 0.12 : 0.06, `rgba(${rgb},0.85)`)
  g.addColorStop(0.24, `rgba(${rgb},0.28)`)
  g.addColorStop(0.5, `rgba(${rgb},0.06)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return canvasTexture(canvas, false)
}

export function ringAlphaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 8
  const ctx = canvas.getContext("2d")!
  const rand = mulberry32(913)
  for (let x = 0; x < canvas.width; x++) {
    const t = x / canvas.width
    let a = 0.55 + 0.35 * Math.sin(t * 80) * Math.sin(t * 23)
    a *= 0.7 + rand() * 0.3
    if (t < 0.18) a *= 0.1
    if (t > 0.94) a *= 0.25
    const v = Math.round(200 + rand() * 40)
    ctx.fillStyle = `rgba(${v},${v - 8},${v - 22},${Math.max(0, Math.min(1, a))})`
    ctx.fillRect(x, 0, 1, canvas.height)
  }
  return canvasTexture(canvas)
}

/** A restrained face-on spiral galaxy texture with real dust lanes. */
export function galaxyTexture(size = 2048, seed = 7): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const rand = mulberry32(seed)
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.47

  // faint halo
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.12)
  halo.addColorStop(0, "rgba(255,228,186,0.10)")
  halo.addColorStop(0.3, "rgba(210,220,255,0.05)")
  halo.addColorStop(0.7, "rgba(120,150,210,0.018)")
  halo.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)

  // central bulge
  const bulge = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.23)
  bulge.addColorStop(0, "rgba(255,244,220,0.95)")
  bulge.addColorStop(0.22, "rgba(255,220,170,0.55)")
  bulge.addColorStop(0.6, "rgba(230,180,130,0.18)")
  bulge.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = bulge
  ctx.fillRect(0, 0, size, size)

  // bar
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.35)
  const bar = ctx.createLinearGradient(-maxR * 0.38, 0, maxR * 0.38, 0)
  bar.addColorStop(0, "rgba(255,220,170,0)")
  bar.addColorStop(0.5, "rgba(255,232,196,0.42)")
  bar.addColorStop(1, "rgba(255,220,170,0)")
  ctx.fillStyle = bar
  ctx.fillRect(-maxR * 0.4, -maxR * 0.055, maxR * 0.8, maxR * 0.11)
  ctx.restore()

  const arms = 4
  const points = 110_000
  for (let i = 0; i < points; i++) {
    const r = Math.pow(rand(), 0.62) * maxR
    const arm = i % arms
    const baseAngle = (arm / arms) * Math.PI * 2
    const spiral = Math.log(Math.max(8, r) / 18) * 2.15
    const spread = (0.16 + r / maxR * 0.26) * (rand() - 0.5)
    const angle = baseAngle + spiral + spread
    const jitter = (rand() - 0.5) * (1.4 + r / maxR * 5)
    const x = cx + Math.cos(angle) * r + jitter
    const y = cy + Math.sin(angle) * r * 0.72 + jitter * 0.6
    const t = r / maxR
    let color: string
    if (t < 0.16) color = `rgba(255,${220 + rand() * 30},${170 + rand() * 50},${0.2 + rand() * 0.5})`
    else if (rand() < 0.06) color = `rgba(255,170,180,${0.22 + rand() * 0.45})`
    else if (rand() < 0.25) color = `rgba(180,205,255,${0.14 + rand() * 0.4})`
    else color = `rgba(235,240,255,${0.12 + rand() * 0.4})`
    ctx.fillStyle = color
    const s = rand() < 0.94 ? 0.7 : 1.4
    ctx.fillRect(x, y, s, s)
  }

  // dust lanes erase light along the inner edges of the arms
  ctx.globalCompositeOperation = "destination-out"
  for (let lane = 0; lane < 7; lane++) {
    for (let i = 0; i < 140; i++) {
      const r = (0.16 + i / 140 * 0.72) * maxR
      const arm = lane % arms
      const baseAngle = (arm / arms) * Math.PI * 2 + 0.34
      const spiral = Math.log(Math.max(8, r) / 18) * 2.15
      const angle = baseAngle + spiral + (rand() - 0.5) * 0.1
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r * 0.72
      const a = 0.025 + rand() * 0.06
      ctx.fillStyle = `rgba(0,0,0,${a})`
      ctx.beginPath()
      ctx.arc(x, y, 4 + rand() * 16, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalCompositeOperation = "source-over"

  // a few bright HII knots
  for (let i = 0; i < 140; i++) {
    const r = (0.2 + rand() * 0.7) * maxR
    const arm = i % arms
    const angle = (arm / arms) * Math.PI * 2 + Math.log(Math.max(8, r) / 18) * 2.15 + (rand() - 0.5) * 0.4
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r * 0.72
    const g = ctx.createRadialGradient(x, y, 0, x, y, 3 + rand() * 8)
    g.addColorStop(0, `rgba(255,190,200,${0.5 + rand() * 0.4})`)
    g.addColorStop(1, "rgba(255,120,150,0)")
    ctx.fillStyle = g
    ctx.fillRect(x - 12, y - 12, 24, 24)
  }

  return canvasTexture(canvas)
}

export function cmbTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size / 2
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(canvas.width, canvas.height)
  const rand = mulberry32(42)
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const n = fbm(x / 18, y / 18, 3, 4) - 0.5
      const m = fbm(x / 55, y / 55, 11, 3) - 0.5
      const v = Math.max(-1, Math.min(1, n * 1.6 + m * 0.8))
      const i = (y * canvas.width + x) * 4
      const r = 128 + v * 92 + (rand() - 0.5) * 10
      const g = 110 + v * 42 + (rand() - 0.5) * 8
      const b = 128 - v * 86 + (rand() - 0.5) * 10
      img.data[i] = Math.max(0, Math.min(255, r))
      img.data[i + 1] = Math.max(0, Math.min(255, g))
      img.data[i + 2] = Math.max(0, Math.min(255, b))
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvasTexture(canvas)
}

export function nebulaSpriteTexture(color = "#d98a9a", seed = 1): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const base = new THREE.Color(color)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2) / (size / 2)
      const dy = (y - size / 2) / (size / 2)
      const r = Math.sqrt(dx * dx + dy * dy)
      const n = fbm(x / 38, y / 38, seed, 5)
      const n2 = fbm(x / 11, y / 11, seed + 7, 3)
      const a = Math.max(0, 1 - r) ** 2.2 * (0.15 + n * 1.1) * (0.6 + n2 * 0.7)
      const i = (y * size + x) * 4
      img.data[i] = Math.min(255, base.r * 255 * (0.6 + n * 0.8))
      img.data[i + 1] = Math.min(255, base.g * 255 * (0.55 + n * 0.8))
      img.data[i + 2] = Math.min(255, base.b * 255 * (0.55 + n * 0.9))
      img.data[i + 3] = Math.max(0, Math.min(255, a * 255))
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvasTexture(canvas)
}

/* ------------------------------------------------------------------ */
/* NASA GIBS surface mosaic                                            */
/* ------------------------------------------------------------------ */

export interface SurfaceMosaic {
  texture: THREE.Texture
  bounds: { lonMin: number; lonMax: number; latMin: number; latMax: number }
  source: "gibs" | "fallback"
}

function mercatorY(latDeg: number): number {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latDeg)) * (Math.PI / 180)
  return (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2
}

async function fetchTile(layer: string, z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = `/api/nasa/gibs?layer=${encodeURIComponent(layer)}&z=${z}&x=${x}&y=${y}`
  })
}

export async function buildGibsMosaic(
  lat: number,
  lng: number,
  spanLat = 9,
  spanLon = 14,
  layer = "BlueMarble_ShadedRelief_Bathymetry",
): Promise<SurfaceMosaic> {
  const latMin = Math.max(-82, lat - spanLat / 2)
  const latMax = Math.min(82, lat + spanLat / 2)
  const lonMin = Math.max(-180, lng - spanLon / 2)
  const lonMax = Math.min(180, lng + spanLon / 2)
  const z = 6
  const n = 2 ** z
  const tileSize = 256
  const x0 = Math.floor(((lonMin + 180) / 360) * n)
  const x1 = Math.floor(((lonMax + 180) / 360) * n)
  const y0 = Math.floor(mercatorY(latMax) * n)
  const y1 = Math.floor(mercatorY(latMin) * n)
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 36) {
    return fallbackMosaic(lat, lng, spanLat, spanLon)
  }

  const mosaic = document.createElement("canvas")
  mosaic.width = (x1 - x0 + 1) * tileSize
  mosaic.height = (y1 - y0 + 1) * tileSize
  const mctx = mosaic.getContext("2d")!
  const jobs: Promise<void>[] = []
  let failures = 0
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      jobs.push(
        fetchTile(layer, z, tx, ty).then((img) => {
          if (!img) {
            failures++
            return
          }
          mctx.drawImage(img, (tx - x0) * tileSize, (ty - y0) * tileSize, tileSize, tileSize)
        }),
      )
    }
  }
  await Promise.all(jobs)
  if (failures > 0 && failures >= jobs.length) {
    return fallbackMosaic(lat, lng, spanLat, spanLon)
  }

  const out = document.createElement("canvas")
  out.width = 1024
  out.height = 1024
  const ctx = out.getContext("2d")!
  const px0 = ((lonMin + 180) / 360) * n * tileSize - x0 * tileSize
  const px1 = ((lonMax + 180) / 360) * n * tileSize - x0 * tileSize
  const srcWidth = Math.max(1, px1 - px0)
  for (let y = 0; y < out.height; y++) {
    const latAt = latMin + (1 - y / out.height) * (latMax - latMin)
    const py = mercatorY(latAt) * n * tileSize - y0 * tileSize
    ctx.drawImage(mosaic, px0, py, srcWidth, 1, 0, y, out.width, 1)
  }
  const tex = canvasTexture(out)
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return { texture: tex, bounds: { lonMin, lonMax, latMin, latMax }, source: "gibs" }
}

function fallbackMosaic(lat: number, lng: number, spanLat: number, spanLon: number): SurfaceMosaic {
  const tex = texture("/textures/earth_day.jpg")
  const lonMin = Math.max(-180, lng - spanLon / 2)
  const lonMax = Math.min(180, lng + spanLon / 2)
  const latMin = Math.max(-82, lat - spanLat / 2)
  const latMax = Math.min(82, lat + spanLat / 2)
  return { texture: tex, bounds: { lonMin, lonMax, latMin, latMax }, source: "fallback" }
}

/** Crop a texture to an equirectangular region for the fallback map plane. */
export function cropTextureRegion(
  source: THREE.Texture,
  bounds: { lonMin: number; lonMax: number; latMin: number; latMax: number },
): THREE.Texture {
  const tex = source.clone()
  tex.needsUpdate = true
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set((bounds.lonMax - bounds.lonMin) / 360, (bounds.latMax - bounds.latMin) / 180)
  tex.offset.set((bounds.lonMin + 180) / 360, (bounds.latMin + 90) / 180)
  return tex
}

/** Crisp ring + crosshair marker used for catalog objects and the origin. */
export function markerTexture(color = "#38bdf8"): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const c = new THREE.Color(color)
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = `rgba(${rgb},0.9)`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(64, 64, 35, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = `rgba(${rgb},0.55)`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(64, 64, 46, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = `rgba(${rgb},0.95)`
  ctx.lineWidth = 2
  for (const [x1, y1, x2, y2] of [
    [64, 14, 64, 28],
    [64, 100, 64, 114],
    [14, 64, 28, 64],
    [100, 64, 114, 64],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.fillStyle = `rgba(${rgb},1)`
  ctx.beginPath()
  ctx.arc(64, 64, 4, 0, Math.PI * 2)
  ctx.fill()
  return canvasTexture(canvas, false)
}

export function canvasLabelTexture(text: string, color = "#f8fafc"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, 512, 128)
  ctx.font = "500 46px Inter, sans-serif"
  ctx.fillStyle = color
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, 256, 64)
  return canvasTexture(canvas)
}
