import * as THREE from "three"
import { ScaleController, REGIME_WORLD_RADIUS } from "./scaleController"
import { SceneBuilder, type BuiltGroup } from "./SceneBuilder"
import type { ScaleRegime } from "../data/catalog/types"

export interface EngineCallbacks {
  onFrame?: (info: EngineInfo) => void
  onRegimeChange?: (r: ScaleRegime) => void
  onTargetFocus?: (id: string | null) => void
}

export interface EngineInfo {
  regime: ScaleRegime
  targetId: string | null
  distanceM: number
}

/** Target focus positions in world space per regime. */
const CAMERA_BASE = {
  earth_map: new THREE.Vector3(0, 0, 520),
  earth_orbit: new THREE.Vector3(0, 40, 700),
  solar_system: new THREE.Vector3(0, 220, 2600),
  interstellar: new THREE.Vector3(0, 300, 2400),
  milky_way: new THREE.Vector3(-4000, 1400, 5000),
  observable_universe: new THREE.Vector3(0, 500, 6000),
}

export class SpaceEngine {
  readonly scale = new ScaleController()
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private builder = new SceneBuilder()
  private groups = new Map<ScaleRegime, BuiltGroup>()
  private targetId: string | null = null
  private raf = 0  private clock = new THREE.Clock()
  private reduced = false
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private focusWorld = new THREE.Vector3()
  private cb: EngineCallbacks
  private sunLight: THREE.DirectionalLight
  private ambient: THREE.AmbientLight
  private disposed = false

  constructor(container: HTMLElement, origin: { lat: number; lng: number }, cb: EngineCallbacks = {}) {
    this.cb = cb
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      1,
      60000,
    )

    this.scene.background = new THREE.Color("#05070b")

    // Lights
    this.ambient = new THREE.AmbientLight("#1e2f4d", 1.2)
    this.scene.add(this.ambient)
    this.sunLight = new THREE.DirectionalLight("#fff3e0", 2.4)
    this.scene.add(this.sunLight)

    // Build all groups
    this.groups.set("earth_map", this.builder.buildEarthMap(origin))
    this.groups.set("earth_orbit", this.builder.buildEarthOrbit())
    this.groups.set("solar_system", this.builder.buildSolarSystem())
    this.groups.set("interstellar", this.builder.buildInterstellar())
    this.groups.set("milky_way", this.builder.buildMilkyWay())
    this.groups.set("observable_universe", this.builder.buildUniverse())

    this.scene.add(this.groups.get("earth_map")!.group)
    this.scene.add(this.groups.get("earth_orbit")!.group)
    this.scene.add(this.groups.get("solar_system")!.group)
    this.scene.add(this.groups.get("interstellar")!.group)
    this.scene.add(this.groups.get("milky_way")!.group)
    this.scene.add(this.groups.get("observable_universe")!.group)

    this.setRegime("earth_map", true)

    // Interaction
    container.addEventListener("pointermove", this.onPointerMove)
    container.addEventListener("click", this.onClick)
    window.addEventListener("resize", this.onResize)

    this.loop()
  }

  private onResize = () => {
    const w = this.renderer.domElement.clientWidth
    const h = this.renderer.domElement.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onPointerMove = (e: PointerEvent) => {
    const el = this.renderer.domElement
    const rect = el.getBoundingClientRect()
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }

  private onClick = (e: MouseEvent) => {
    const el = this.renderer.domElement
    const rect = el.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    for (const [regime, bg] of this.groups) {
      if (regime !== this.scale.current) continue
      const hits = this.raycaster.intersectObjects(bg.group.children, true)
      if (hits.length > 0) {
        const obj = this.findBodyFromHit(hits[0].object, bg)
        if (obj) {
          this.focusTarget(obj.id, regime)
          return
        }
      }
    }
    this.cb.onTargetFocus?.(null)
  }

  private findBodyFromHit(obj: THREE.Object3D, bg: BuiltGroup): { id: string } | null {
    let cur: THREE.Object3D | null = obj
    while (cur) {
      if (cur.userData.bodyId) return { id: cur.userData.bodyId as string }
      cur = cur.parent
    }
    // Map by checking group positions
    for (const [id, o] of bg.bodies) {
      if (o === obj || obj.parent === o) return { id }
    }
    return null
  }

  setRegime(r: ScaleRegime, immediate = false) {
    this.scale.setRegime(r)
    // Crossfade groups
    for (const [regime, bg] of this.groups) {
      const visible = regime === r
      bg.group.visible = true
      this.setGroupOpacity(bg, visible ? 1 : 0, immediate || this.reduced)
    }
    this.cb.onRegimeChange?.(r)
    this.cb.onTargetFocus?.(null)
    this.targetId = null
    const base = CAMERA_BASE[r]
    this.focusWorld.copy(base)
    this.camera.position.copy(base)
    this.camera.lookAt(this.focusWorld)
  }

  private setGroupOpacity(bg: BuiltGroup, target: number, immediate: boolean) {
    const t = immediate ? 1 : Math.min(1, this.clock.getDelta() * 2.4)
    bg.group.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!mat) return
      const mats = Array.isArray(mat) ? mat : [mat]
      for (const m of mats) {
        if ("opacity" in m) {
          const current = (m as THREE.Material).opacity
            ; (m as THREE.Material).opacity = current + (target - current) * t
            ; (m as THREE.Material).transparent = true
        }
      }
    })
  }

  focusTarget(id: string, regime: ScaleRegime) {
    if (!this.groups.has(regime)) return
    const bg = this.groups.get(regime)!
    const body = bg.bodies.get(id)
    if (!body) return

    // Switch regime group to that regime
    for (const [r, g] of this.groups) {
      g.group.visible = r === regime
      this.setGroupOpacity(g, r === regime ? 1 : 0, true)
    }
    this.scale.setRegime(regime)
    this.targetId = id
    const pos = new THREE.Vector3()
    body.getWorldPosition(pos)

    // Camera target slightly behind/above the object
    const dist = Math.max(2, REGIME_WORLD_RADIUS[regime] * 0.12)
    const dir = pos.clone().normalize()
    const camPos = pos.clone().add(dir.clone().multiplyScalar(dist * 2.2))
    camPos.y += dist
    this.camera.position.copy(camPos)
    this.camera.lookAt(pos)
    this.focusWorld.copy(pos)
    this.cb.onRegimeChange?.(regime)
    this.cb.onTargetFocus?.(id)
  }

  /** Fly camera smoothly to a target (used by the agent / missions). */
  flyToTarget(id: string, regime: ScaleRegime, durationMs = 1800) {
    if (this.reduced) {
      this.focusTarget(id, regime)
      return
    }
    const t0 = this.clock.elapsedTime
    const from = this.camera.position.clone()
    const bg = this.groups.get(regime)
    if (!bg) return
    const body = bg.bodies.get(id)
    if (!body) return

    // Set up the group as active
    for (const [r, g] of this.groups) {
      g.group.visible = r === regime
      this.setGroupOpacity(g, r === regime ? 1 : 0, true)
    }
    this.scale.setRegime(regime)

    const pos = new THREE.Vector3()
    body.getWorldPosition(pos)
    const dist = Math.max(2, REGIME_WORLD_RADIUS[regime] * 0.12)
    const dir = pos.clone().normalize()
    const target = pos.clone().add(dir.clone().multiplyScalar(dist * 2.2))
    target.y += dist

    const duration = durationMs / 1000
    this.animateCamera(from, target, pos, duration, t0)
  }

  private animateCamera(from: THREE.Vector3, target: THREE.Vector3, look: THREE.Vector3, duration: number, t0: number) {
    const step = (now: number) => {
      if (this.disposed) return
      const t = Math.min(1, (now - t0) / duration)
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      this.camera.position.lerpVectors(from, target, ease)
      const lookPos = new THREE.Vector3().lerpVectors(this.focusWorld, look, ease)
      this.camera.lookAt(lookPos)
      this.focusWorld.copy(lookPos)
      if (t < 1) this.raf = requestAnimationFrame(step)
      else {
        this.targetId = this.targetId
        this.cb.onTargetFocus?.(this.targetId)
      }
    }
    this.raf = requestAnimationFrame(step)
  }

  getTargetId(): string | null {
    return this.targetId
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = this.clock.getDelta()
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    this.cb.onFrame?.({
      regime: this.scale.current,
      targetId: this.targetId,
      distanceM: this.camera.position.length(),
    })
  }

  private update(dt: number) {
    // Orbit rotation for solar system groups
    const solar = this.groups.get("solar_system")
    if (solar) {
      solar.group.rotation.y += dt * 0.004
    }
    const orbit = this.groups.get("earth_orbit")
    if (orbit) {
      const moonOrbit = orbit.bodies.get("moonOrbit")
      if (moonOrbit) moonOrbit.rotation.y += dt * 0.1
      const iss = orbit.bodies.get("iss")
      if (iss) iss.rotation.y += dt * 0.6
    }
    // Slow auto-rotation of whole universe backdrop
    const uni = this.groups.get("observable_universe")
    if (uni) uni.group.rotation.y += dt * 0.002
  }

  setOrigin(origin: { lat: number; lng: number }) {
    // Rebuild earth map
    const bg = this.builder.buildEarthMap(origin)
    const old = this.groups.get("earth_map")!
    this.scene.remove(old.group)
    this.scene.add(bg.group)
    this.groups.set("earth_map", bg)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove)
    this.renderer.domElement.removeEventListener("click", this.onClick)
    window.removeEventListener("resize", this.onResize)
    for (const bg of this.groups.values()) {
      bg.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const m of mats) {
            const withMap = m as THREE.Material & { map?: { dispose(): void } }
            withMap.map?.dispose()
              ; (m as THREE.Material).dispose()
          }
        }
      })
    }
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
