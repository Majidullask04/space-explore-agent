import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

interface Progress {
  /** 0..1 overall scroll progress */
  raw: number
  /** chapter position as a float, 0..6 */
  chapterRaw: number
}

type Props = {
  progress: React.MutableRefObject<Progress>
  reduced: boolean
}

/* Camera + light keyframes, one entry per chapter boundary (0..6). */
const CAM_Z = [30, 24, 7.6, 5.2, 15, 8.6, 6.6]
const CAM_X = [0, 0, -1.7, 0, 0.9, 0, 0]
const CAM_Y = [0.6, 0.4, 0.1, -0.4, 0, 0.3, 0.15]
const SUN_X = [4, 4, 3, 3, 3, 3, -6.5]
const SUN_Y = [2, 2, 1.8, 1.8, 1.8, 1.4, 0.6]
const SUN_Z = [6, 6, 5.5, 5.5, 5.5, 4.5, 1.8]
const SUN_WARM = [0, 0, 0, 0, 0, 0.1, 1]
const STAR_TWIST = [0, 0.12, 0.35, 0.7, 1.05, 1.3, 1.55]
/** How present the planet is in each chapter: a faint spark, then the centre of everything. */
const PRESENCE = [0.12, 1, 1, 1, 1, 1, 1.2]

const SUNLIGHT_COOL = new THREE.Color("#fff3e0")
const SUNLIGHT_WARM = new THREE.Color("#ffd69a")
const ATMOSPHERE_COOL = new THREE.Color("#38a5e8")
const ATMOSPHERE_WARM = new THREE.Color("#ffb36b")

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sstep = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** Sample a keyframe track at chapter float c in [0, 6]. */
function kf(values: number[], c: number): number {
  const i = Math.min(Math.floor(c), values.length - 2)
  return lerp(values[i], values[i + 1], sstep(clamp01(c - i)))
}

function glowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, "rgba(255, 236, 200, 1)")
  g.addColorStop(0.25, "rgba(255, 214, 154, 0.55)")
  g.addColorStop(0.6, "rgba(255, 214, 154, 0.12)")
  g.addColorStop(1, "rgba(255, 214, 154, 0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

/** Soft round sprite so particles read as stars, not squares. */
function dotTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, "rgba(255, 255, 255, 1)")
  g.addColorStop(0.4, "rgba(255, 255, 255, 0.5)")
  g.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ATMOSPHERE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uWarm;
  uniform float uWarmMix;
  uniform float uGain;
  varying vec3 vNormal;
  void main() {
    float rim = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.4);
    vec3 color = mix(uColor, uWarm, uWarmMix);
    gl_FragColor = vec4(color, 1.0) * clamp(rim, 0.0, 1.0) * uGain;
  }
`

export default function CosmosCanvas({ progress, reduced }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
    } catch {
      setFailed(true)
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#03050b")

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500)

    /* ----- stars: a shell of points with mixed colour temperatures ----- */
    const starCount = 6000
    const starPositions = new Float32Array(starCount * 3)
    const starColors = new Float32Array(starCount * 3)
    const white = new THREE.Color("#f4f7fa")
    const blue = new THREE.Color("#9fc7ff")
    const warm = new THREE.Color("#ffd7a1")
    const pick = new THREE.Color()
    for (let i = 0; i < starCount; i++) {
      const r = 40 + Math.random() * 110
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = r * Math.cos(phi)
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const roll = Math.random()
      pick.copy(roll < 0.7 ? white : roll < 0.9 ? blue : warm)
      pick.multiplyScalar(0.45 + Math.random() * 0.55)
      starColors[i * 3] = pick.r
      starColors[i * 3 + 1] = pick.g
      starColors[i * 3 + 2] = pick.b
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3))
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3))
    const starMaterial = new THREE.PointsMaterial({
      size: 0.55,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const stars = new THREE.Points(starGeometry, starMaterial)
    scene.add(stars)

    /* ----- near dust for depth ----- */
    const dustCount = 260
    const dustPositions = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 22
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 14
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 16 + 2
    }
    const dustGeometry = new THREE.BufferGeometry()
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3))
    const dustMaterial = new THREE.PointsMaterial({
      color: "#8fb8e8",
      size: 0.05,
      map: dotTexture(),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
    const dust = new THREE.Points(dustGeometry, dustMaterial)
    scene.add(dust)

    /* ----- earth ----- */
    const earthGroup = new THREE.Group()
    scene.add(earthGroup)

    const earthMaterial = new THREE.MeshPhongMaterial({
      color: "#1c3a55",
      specular: new THREE.Color("#2b4d6f"),
      shininess: 14,
    })
    const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 96, 96), earthMaterial)
    earthGroup.add(earth)

    const cloudMaterial = new THREE.MeshLambertMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(2.02, 96, 96), cloudMaterial)
    earthGroup.add(clouds)

    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERT,
      fragmentShader: ATMOSPHERE_FRAG,
      uniforms: {
        uColor: { value: ATMOSPHERE_COOL },
        uWarm: { value: ATMOSPHERE_WARM },
        uWarmMix: { value: 0 },
        uGain: { value: 1 },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 64), atmosphereMaterial)
    atmosphere.scale.setScalar(1.18)
    earthGroup.add(atmosphere)

    /* ----- lights ----- */
    scene.add(new THREE.AmbientLight("#1e2f4d", 1.5))
    const sun = new THREE.DirectionalLight(SUNLIGHT_COOL, 2.6)
    scene.add(sun)

    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: SUNLIGHT_WARM,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    scene.add(sunSprite)

    /* ----- texture loading ----- */
    const loader = new THREE.TextureLoader()
    let pending = 0
    const onTexture = () => {
      pending--
      if (pending === 0) {
        earthMaterial.color.set("#ffffff")
        earthMaterial.needsUpdate = true
      }
    }
    const load = (url: string, apply: (t: THREE.Texture) => void) => {
      pending++
      loader.load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
        apply(t)
        onTexture()
      })
    }
    load("/textures/earth_atmos_2048.jpg", (t) => {
      earthMaterial.map = t
      earthMaterial.needsUpdate = true
    })
    load("/textures/earth_normal_2048.jpg", (t) => {
      earthMaterial.normalMap = t
      earthMaterial.normalScale = new THREE.Vector2(0.8, 0.8)
      earthMaterial.needsUpdate = true
    })
    load("/textures/earth_specular_2048.jpg", (t) => {
      earthMaterial.specularMap = t
      earthMaterial.needsUpdate = true
    })
    loader.load(
      "/textures/clouds_2k.png",
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        cloudMaterial.map = t
        cloudMaterial.opacity = 0.75
        cloudMaterial.needsUpdate = true
      },
      undefined,
      onTexture,
    )

    /* ----- interaction state ----- */
    const pointer = { x: 0, y: 0 }
    const pointerSmooth = { x: 0, y: 0 }
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener("pointermove", onPointerMove)

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener("resize", onResize)

    /* ----- render loop ----- */
    let elapsed = 0
    let chapterSmooth = 0
    let earthSpin = 0
    let raf = 0
    let last = performance.now()

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      elapsed += dt

      // ease chapter float toward its raw value for cinematic weight
      const k = reduced ? 1 : Math.min(1, dt * 2.6)
      chapterSmooth += (progress.current.chapterRaw - chapterSmooth) * k

      // stars slowly appear, then keep a quiet presence
      starMaterial.opacity = Math.min(1, elapsed / 4.5) * 0.95

      const c = chapterSmooth
      const px = reduced ? 0 : pointer.x
      const py = reduced ? 0 : pointer.y
      pointerSmooth.x += (px - pointerSmooth.x) * Math.min(1, dt * 2)
      pointerSmooth.y += (py - pointerSmooth.y) * Math.min(1, dt * 2)

      const driftX = reduced ? 0 : Math.sin(elapsed * 0.11) * 0.07
      const driftY = reduced ? 0 : Math.cos(elapsed * 0.09) * 0.05

      camera.position.set(
        kf(CAM_X, c) + driftX + pointerSmooth.x * 0.25,
        kf(CAM_Y, c) + driftY - pointerSmooth.y * 0.18,
        kf(CAM_Z, c),
      )
      camera.lookAt(0, 0, 0)

      sun.position.set(kf(SUN_X, c), kf(SUN_Y, c), kf(SUN_Z, c))
      const warmth = kf(SUN_WARM, c)
      const presence = kf(PRESENCE, c)
      sun.color.copy(SUNLIGHT_COOL).lerp(SUNLIGHT_WARM, warmth)
      sun.intensity = lerp(3.6, 4, warmth) * presence

      atmosphereMaterial.uniforms.uWarmMix.value = warmth
      atmosphereMaterial.uniforms.uGain.value = presence

      // sunrise glow hugging the limb
      const sunDir = sun.position.clone().normalize()
      sunSprite.position.copy(sunDir).multiplyScalar(70)
      sunSprite.material.opacity = warmth * 0.85 * presence
      sunSprite.scale.setScalar(lerp(10, 30, warmth))

      // slow, deliberate rotation; scroll gently turns the planet too
      earthSpin += dt * 0.02
      earth.rotation.y = earthSpin + c * 0.5
      clouds.rotation.y = earthSpin * 1.22 + c * 0.55
      cloudMaterial.opacity = 0.55 * clamp01((c - 0.6) / 1.2) * presence

      stars.rotation.y = (reduced ? 0 : elapsed * 0.0035) + kf(STAR_TWIST, c)
      stars.rotation.x = pointerSmooth.y * 0.03
      dust.rotation.y = elapsed * 0.01
      dust.position.z = Math.sin(elapsed * 0.08) * 0.6

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("resize", onResize)
      starGeometry.dispose()
      starMaterial.dispose()
      dustGeometry.dispose()
      dustMaterial.dispose()
      earth.geometry.dispose()
      earthMaterial.dispose()
      clouds.geometry.dispose()
      cloudMaterial.dispose()
      atmosphere.geometry.dispose()
      atmosphereMaterial.dispose()
      sunSprite.material.map?.dispose()
      sunSprite.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [progress, reduced])

  if (failed) {
    return <div className="cosmos-fallback" aria-hidden="true" />
  }
  return <div ref={hostRef} className="cosmos" aria-hidden="true" />
}
