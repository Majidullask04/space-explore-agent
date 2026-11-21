import * as THREE from "three"
import { CameraRig } from "./CameraRig"
import {
  SceneBuilder,
  type BuiltRegime,
  type LabelSpec,
  type UpdateContext,
} from "./SceneBuilder"
import type {
  ExoplanetRecord,
  IssState,
  LayerState,
  Origin,
  RegimeId,
  StarRecord,
} from "../data/types"
import { disposeObject } from "./helpers"
import {
  BODY_LOG_DIST,
  formatLightTime,
  formatPhysicalDistance,
  getPrimaryRegime,
  getRegimeWeights,
  getRegionName,
} from "./scaleController"

export interface EngineInfo {
  regime: RegimeId
  targetId: string | null
  logDist: number
  distanceFromEarthM: number
  lightTimeSeconds: number
  regionName: string
  distanceLabel: string
  lightTimeLabel: string
  simDate: number
  hudDim: boolean
  surfaceSource: "gibs" | "fallback" | "none"
}

export interface EngineCallbacks {
  onFrame?: (info: EngineInfo) => void
  onRegimeChange?: (regime: RegimeId) => void
  onTargetFocus?: (id: string | null) => void
  onSurfaceSource?: (source: "gibs" | "fallback") => void
  onReady?: () => void
}

export interface EngineOptions {
  stars: StarRecord[]
  origin: Origin
  iss?: IssState | null
  exoplanets?: ExoplanetRecord[]
  layers: LayerState
}

interface LabelEntry {
  spec: LabelSpec
  element: HTMLButtonElement
  name: HTMLElement
  sub: HTMLElement
  lastSub: string
  visible: boolean
}

interface HomePose {
  target: THREE.Vector3
  yaw: number
  pitch: number
  distance: number
  min: number
  max: number
  base: number
}

export const DEFAULT_LAYERS: LayerState = {
  orbits: true,
  labels: true,
  constellations: true,
  spacecraft: true,
  belts: true,
  grid: true,
}

export class CosmicEngine {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private rig: CameraRig
  private builder: SceneBuilder
  private regimes: Record<RegimeId, BuiltRegime>
  private regime: RegimeId = "surface"
  private targetId: string | null = null
  private labels: LabelEntry[] = []
  private labelLayer: HTMLDivElement
  private veil: HTMLDivElement
  private callbacks: EngineCallbacks
  private origin: Origin
  private iss: IssState | null
  private layers: LayerState
  private simTimeMs = Date.now()
  private timeWarp = 1
  private lastSpeed = 1
  private raf = 0
  private clock = new THREE.Clock()
  private disposed = false
  private frameAccumulator = 0
  private labelSubAccumulator = 0
  private downPoint: { x: number; y: number } | null = null
  private raycaster = new THREE.Raycaster()
  private resizeObserver: ResizeObserver
  private surfaceSource: "gibs" | "fallback" | "none" = "none"
  private fpsFrames = 0
  private fpsTime = 0
  private fps = 60

  constructor(container: HTMLElement, options: EngineOptions, callbacks: EngineCallbacks = {}) {
    this.container = container
    this.callbacks = callbacks
    this.origin = options.origin
    this.iss = options.iss ?? null
    this.layers = { ...DEFAULT_LAYERS, ...options.layers }

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    this.renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D space view")
    container.appendChild(this.renderer.domElement)

    this.labelLayer = document.createElement("div")
    this.labelLayer.className = "scene-label-layer"
    container.appendChild(this.labelLayer)

    this.veil = document.createElement("div")
    this.veil.className = "regime-veil"
    container.appendChild(this.veil)

    this.camera = new THREE.PerspectiveCamera(
      48,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.05,
      120000,
    )
    this.scene.background = new THREE.Color("#000000")
    this.rig = new CameraRig(this.camera, this.renderer.domElement, 2.4)
    this.rig.autoRotate = false
    this.rig.onInteraction = () => {
      if (
        this.targetId &&
        (this.rig.wasDrag() ||
          Math.abs(this.rig.state.logDist - (BODY_LOG_DIST[this.targetId] ?? 0)) > 0.5)
      ) {
        this.select(null, false)
      }
      this.callbacks.onFrame?.(this.frameInfo())
    }

    this.builder = new SceneBuilder(options.stars)
    this.builder.onSurfaceSource = (source) => {
      this.surfaceSource = source
      this.callbacks.onSurfaceSource?.(source)
    }
    this.regimes = {
      surface: this.builder.buildSurface(options.origin),
      orbit: this.builder.buildOrbit(),
      solar_system: this.builder.buildSolarSystem(),
      interstellar: this.builder.buildInterstellar(options.exoplanets),
      milky_way: this.builder.buildMilkyWay(),
      universe: this.builder.buildUniverse(),
    }
    for (const built of Object.values(this.regimes)) {
      built.group.visible = false
      this.scene.add(built.group)
    }
    this.regimes.surface.group.visible = true
    this.applyLayers()
    this.applyHome("surface", true)
    this.rebuildLabels()

    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown)
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp)
    this.renderer.domElement.addEventListener("pointercancel", this.onPointerCancel)

    this.resizeObserver = new ResizeObserver(this.onResize)
    this.resizeObserver.observe(container)
    window.addEventListener("resize", this.onResize)

    this.clock.start()
    this.raf = requestAnimationFrame(this.loop)
    requestAnimationFrame(() => this.callbacks.onReady?.())
  }

  /* ------------------------------------------------------------------ */
  /* Regimes                                                             */
  /* ------------------------------------------------------------------ */

  setRegime(regime: RegimeId, immediate = false) {
    const REGIME_CENTERS: Record<RegimeId, number> = {
      surface: 2.4,
      orbit: 6.2,
      solar_system: 10.5,
      interstellar: 16.6,
      milky_way: 20.2,
      universe: 26.5,
    }
    const targetLog = REGIME_CENTERS[regime] ?? 2.4
    this.setLogDist(targetLog, immediate)
    this.applyHome(regime, immediate)
  }

  setLogDist(logDist: number, immediate = false) {
    this.rig.setLogDist(logDist, immediate)
    const primary = getPrimaryRegime(logDist)
    if (primary !== this.regime) {
      this.regime = primary
      this.callbacks.onRegimeChange?.(primary)
      this.rebuildLabels()
    }
    this.callbacks.onFrame?.(this.frameInfo())
  }

  setStars(stars: StarRecord[]) {
    this.builder.setStars(stars)
  }

  async flyToBody(id: string, duration = 2.0): Promise<void> {
    const targetLog = BODY_LOG_DIST[id]
    if (targetLog !== undefined) {
      this.setLogDist(targetLog)
    }
    await this.flyToTarget(id, undefined, duration)
  }

  private applyHome(regime: RegimeId, immediate: boolean) {
    for (const [id, built] of Object.entries(this.regimes) as Array<[RegimeId, BuiltRegime]>) {
      built.group.visible = id === regime
    }
    this.regime = regime
    this.targetId = null
    this.rig.followTarget(null)
    this.callbacks.onTargetFocus?.(null)
    this.callbacks.onRegimeChange?.(regime)
    this.applyLayers()
    this.rebuildLabels()
    const home = this.homePose(regime)
    this.rig.setBounds(home.min, home.max, home.base)
    this.rig.autoRotate = regime !== "surface"
    if (immediate) {
      this.rig.setPose(home, true)
    } else {
      this.rig.setPose(
        {
          target: home.target,
          yaw: home.yaw - 0.4,
          pitch: Math.min(1.1, home.pitch + 0.28),
          distance: home.distance * 1.75,
        },
        true,
      )
      this.rig.flyTo(home, 2.1, "power2.inOut")
    }
    this.frameAccumulator = 1
  }

  private homePose(regime: RegimeId): HomePose {
    switch (regime) {
      case "surface": {
        const marker = this.regimes.surface.labels.find((label) => label.id === "origin")
        return {
          target: marker ? marker.getPosition() : new THREE.Vector3(),
          yaw: 0,
          pitch: 0.01,
          distance: 640,
          min: 140,
          max: 1800,
          base: 640,
        }
      }
      case "orbit":
        return {
          target: new THREE.Vector3(),
          yaw: 0.68,
          pitch: 0.18,
          distance: 330,
          min: 132,
          max: 900,
          base: 330,
        }
      case "solar_system":
        return {
          target: new THREE.Vector3(),
          yaw: 0.92,
          pitch: 0.62,
          distance: 430,
          min: 20,
          max: 1200,
          base: 430,
        }
      case "interstellar":
        return {
          target: new THREE.Vector3(),
          yaw: 0.82,
          pitch: 0.32,
          distance: 120,
          min: 4,
          max: 2400,
          base: 120,
        }
      case "milky_way":
        return {
          target: new THREE.Vector3(20, 0, 0),
          yaw: 0.72,
          pitch: 0.92,
          distance: 190,
          min: 12,
          max: 460,
          base: 190,
        }
      case "universe":
        return {
          target: new THREE.Vector3(),
          yaw: 0.8,
          pitch: 0.42,
          distance: 236,
          min: 14,
          max: 620,
          base: 236,
        }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Focus and flights                                                   */
  /* ------------------------------------------------------------------ */

  select(id: string | null, fly = true) {
    if (!id) {
      this.targetId = null
      this.rig.followTarget(null)
      this.callbacks.onTargetFocus?.(null)
      this.updateLabelActive()
      return
    }
    const object = this.current().bodies.get(id)
    if (!object) {
      this.targetId = id
      this.callbacks.onTargetFocus?.(id)
      this.updateLabelActive()
      return
    }
    this.targetId = id
    this.rig.followTarget(() => object.getWorldPosition(new THREE.Vector3()))
    this.callbacks.onTargetFocus?.(id)
    this.updateLabelActive()
    if (fly) void this.flyToTarget(id)
  }

  async flyToTarget(id: string, regime?: RegimeId, duration = 2.3): Promise<void> {
    const targetLog = BODY_LOG_DIST[id]
    if (targetLog !== undefined) {
      this.rig.setLogDist(targetLog)
    }
    const resolved = this.resolveRegime(id, regime)
    if (resolved !== this.regime) {
      this.regime = resolved
      this.callbacks.onRegimeChange?.(resolved)
      this.rebuildLabels()
    }
    const built = this.current()
    const object = built.bodies.get(id)
    if (!object) return
    this.targetId = id
    this.rig.followTarget(() => object.getWorldPosition(new THREE.Vector3()))
    this.callbacks.onTargetFocus?.(id)
    this.updateLabelActive()
    const target = object.getWorldPosition(new THREE.Vector3())
    const distance =
      object.userData.focusDistance ??
      built.focusDistance?.[id] ??
      Math.max(12, this.rig.desired.distance * 0.45)
    const current = this.rig.desired
    const yaw = current.yaw + 0.35
    const pitch = Math.max(0.12, Math.min(0.7, current.pitch * 0.7 + 0.12))
    await new Promise<void>((resolve) => {
      this.rig.flyTo(
        { target, distance, yaw, pitch, logDist: targetLog },
        duration,
        "power3.inOut",
        resolve,
      )
    })
  }

  private resolveRegime(id: string, hint?: RegimeId): RegimeId {
    if (hint) return hint
    for (const [regime, built] of Object.entries(this.regimes) as Array<[RegimeId, BuiltRegime]>) {
      if (built.bodies.has(id)) return regime
    }
    return this.regime
  }

  private current(): BuiltRegime {
    return this.regimes[this.regime]
  }

  /* ------------------------------------------------------------------ */
  /* Data updates                                                        */
  /* ------------------------------------------------------------------ */

  setOrigin(origin: Origin) {
    this.origin = origin
    const old = this.regimes.surface
    const next = this.builder.buildSurface(origin)
    this.scene.remove(old.group)
    disposeObject(old.group)
    this.regimes.surface = next
    next.group.visible = this.regime === "surface"
    this.scene.add(next.group)
    if (this.regime === "surface") {
      this.rebuildLabels()
      const marker = next.labels.find((label) => label.id === "origin")
      if (marker) {
        this.rig.setPose({ target: marker.getPosition(), distance: 640, yaw: 0, pitch: 0.01 }, true)
      }
    }
    this.frameAccumulator = 1
  }

  setIss(iss: IssState | null) {
    this.iss = iss
  }

  setExoplanets(records: ExoplanetRecord[]) {
    const exoGroup = this.regimes.interstellar.group.getObjectByName("exoplanets")
    if (exoGroup instanceof THREE.Group) this.builder.populateExoplanets(exoGroup, records)
  }

  setLayers(layers: LayerState) {
    this.layers = { ...layers }
    this.applyLayers()
    this.updateLabelVisibility()
  }

  private applyLayers() {
    this.current().group.traverse((object) => {
      const layer = object.userData.layer as keyof LayerState | undefined
      if (!layer) return
      object.visible = Boolean(this.layers[layer])
    })
  }

  setTimeWarp(speed: number) {
    if (speed > 0) this.lastSpeed = speed
    this.timeWarp = Math.max(0, speed)
    this.frameAccumulator = 1
  }

  setSimDate(date: Date) {
    this.simTimeMs = date.getTime()
    this.frameAccumulator = 1
  }

  resetTime() {
    this.simTimeMs = Date.now()
    this.frameAccumulator = 1
  }

  pause() {
    if (this.timeWarp > 0) this.lastSpeed = this.timeWarp
    this.timeWarp = 0
  }

  resume() {
    this.timeWarp = this.lastSpeed || 1
  }

  getTimeWarp(): number {
    return this.timeWarp
  }

  getSimDate(): Date {
    return new Date(this.simTimeMs)
  }

  getRegime(): RegimeId {
    return this.regime
  }

  getTargetId(): string | null {
    return this.targetId
  }

  /* ------------------------------------------------------------------ */
  /* Labels                                                              */
  /* ------------------------------------------------------------------ */

  private rebuildLabels() {
    this.labelLayer.textContent = ""
    this.labels = []
    const specs = this.current().labels
    for (const spec of specs) {
      const element = document.createElement("button")
      element.type = "button"
      element.className = `scene-label scene-label-${spec.kind ?? "object"}`
      element.dataset.bodyId = spec.bodyId ?? spec.id
      element.style.pointerEvents = "auto"
      const name = document.createElement("span")
      name.className = "scene-label-name"
      name.textContent = spec.name
      const sub = document.createElement("span")
      sub.className = "scene-label-sub"
      sub.textContent = spec.sub ?? ""
      element.append(name, sub)
      element.addEventListener("click", (event) => {
        event.stopPropagation()
        this.select(spec.bodyId ?? spec.id, true)
      })
      this.labelLayer.appendChild(element)
      this.labels.push({
        spec,
        element,
        name,
        sub,
        lastSub: spec.sub ?? "",
        visible: false,
      })
    }
    this.updateLabelVisibility()
  }

  private updateLabelVisibility() {
    if (!this.layers.labels) {
      for (const entry of this.labels) entry.element.classList.add("is-hidden")
      return
    }
    for (const entry of this.labels) {
      const kind = entry.spec.kind
      let allowed = true
      if (kind === "spacecraft") allowed = this.layers.spacecraft
      else if (kind === "belt") allowed = this.layers.belts
      else if (kind === "scale") allowed = this.layers.grid
      entry.element.classList.toggle("is-hidden", !allowed)
    }
  }

  private updateLabels(dt: number) {
    this.labelSubAccumulator += dt
    const refreshSub = this.labelSubAccumulator > 0.4
    if (refreshSub) this.labelSubAccumulator = 0
    if (!this.layers.labels) return
    const width = this.renderer.domElement.clientWidth
    const height = this.renderer.domElement.clientHeight
    const cameraDir = this.camera.getWorldDirection(new THREE.Vector3())
    const cameraPos = this.camera.position
    const ctx: UpdateContext = {
      date: new Date(this.simTimeMs),
      dt,
      iss: this.iss,
      origin: this.origin,
      layers: this.layers,
    }
    for (const entry of this.labels) {
      const { spec, element } = entry
      const kind = spec.kind
      if (kind === "spacecraft" && !this.layers.spacecraft) {
        element.classList.add("is-hidden")
        continue
      }
      if (kind === "belt" && !this.layers.belts) {
        element.classList.add("is-hidden")
        continue
      }
      if (kind === "scale" && !this.layers.grid) {
        element.classList.add("is-hidden")
        continue
      }
      const world = spec.getPosition()
      const toPoint = world.clone().sub(cameraPos)
      const distance = toPoint.length()
      if (spec.maxCameraDistance !== undefined && distance > spec.maxCameraDistance) {
        element.classList.add("is-hidden")
        continue
      }
      if (spec.minCameraDistance !== undefined && distance < spec.minCameraDistance) {
        element.classList.add("is-hidden")
        continue
      }
      if (toPoint.dot(cameraDir) <= 0) {
        element.classList.add("is-hidden")
        continue
      }
      const projected = world.clone().project(this.camera)
      if (projected.z > 1 || projected.z < -1) {
        element.classList.add("is-hidden")
        continue
      }
      if (projected.x < -1.03 || projected.x > 1.03 || projected.y < -1.03 || projected.y > 1.03) {
        element.classList.add("is-hidden")
        continue
      }
      const x = (projected.x * 0.5 + 0.5) * width
      const y = (-projected.y * 0.5 + 0.5) * height
      element.style.left = `${x.toFixed(1)}px`
      element.style.top = `${y.toFixed(1)}px`
      element.classList.remove("is-hidden")
      element.classList.toggle("is-active", spec.bodyId === this.targetId)
      entry.visible = true
      if (refreshSub && spec.getSub) {
        const next = spec.getSub(ctx) ?? ""
        if (next !== entry.lastSub) {
          entry.sub.textContent = next
          entry.sub.classList.toggle("is-empty", !next)
          entry.lastSub = next
        }
      }
    }
  }

  private updateLabelActive() {
    for (const entry of this.labels) {
      entry.element.classList.toggle("is-active", entry.spec.bodyId === this.targetId)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pointer interaction                                                 */
  /* ------------------------------------------------------------------ */

  private onPointerDown = (event: PointerEvent) => {
    this.downPoint = { x: event.clientX, y: event.clientY }
  }

  private onPointerCancel = () => {
    this.downPoint = null
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.downPoint) return
    const moved = Math.hypot(event.clientX - this.downPoint.x, event.clientY - this.downPoint.y)
    this.downPoint = null
    if (moved > 6) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    this.raycaster.params.Points.threshold = 2
    const hits = this.raycaster.intersectObjects(this.current().group.children, true)
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object
      while (object) {
        const bodyId = object.userData.bodyId as string | undefined
        if (bodyId && bodyId !== "exoplanet-field") {
          this.select(bodyId, true)
          return
        }
        object = object.parent
      }
    }
    this.select(null, false)
  }

  /* ------------------------------------------------------------------ */
  /* Frame loop                                                          */
  /* ------------------------------------------------------------------ */

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.06, this.clock.getDelta())
    this.fpsFrames++
    this.fpsTime += dt
    if (this.fpsTime > 1) {
      this.fps = this.fpsFrames / this.fpsTime
      this.fpsFrames = 0
      this.fpsTime = 0
    }
    if (this.timeWarp > 0) this.simTimeMs += dt * 1000 * this.timeWarp
    const date = new Date(this.simTimeMs)

    this.rig.update(dt)

    // Continuous logarithmic regime crossfading
    const logDist = this.rig.state.logDist
    const primary = getPrimaryRegime(logDist)
    if (primary !== this.regime) {
      this.regime = primary
      this.callbacks.onRegimeChange?.(primary)
      this.rebuildLabels()
    }

    const weights = getRegimeWeights(logDist)
    for (const [id, built] of Object.entries(this.regimes) as Array<[RegimeId, BuiltRegime]>) {
      const w = weights[id]
      const visible = w > 0.005
      built.group.visible = visible
      if (visible) {
        applyGroupOpacity(built.group, w)
        built.update?.({
          date,
          dt,
          iss: this.iss,
          origin: this.origin,
          layers: this.layers,
        })
      }
    }

    this.scene.updateMatrixWorld(true)
    this.updateLabels(dt)
    this.renderer.render(this.scene, this.camera)

    this.frameAccumulator += dt
    if (this.frameAccumulator > 0.08) {
      this.frameAccumulator = 0
      this.callbacks.onFrame?.(this.frameInfo())
    }
  }

  private frameInfo(): EngineInfo {
    const logDist = this.rig.state.logDist
    const distM = Math.pow(10, logDist)
    const c = 299792458
    const lightTimeS = distM / c
    return {
      regime: this.regime,
      targetId: this.targetId,
      logDist,
      distanceFromEarthM: distM,
      lightTimeSeconds: lightTimeS,
      regionName: getRegionName(logDist, this.origin.label),
      distanceLabel: formatPhysicalDistance(distM),
      lightTimeLabel: formatLightTime(lightTimeS),
      simDate: this.simTimeMs,
      hudDim: this.rig.isInteracting,
      surfaceSource: this.surfaceSource,
    }
  }

  private onResize = () => {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.frameAccumulator = 1
  }

  getStats() {
    return {
      regime: this.regime,
      targetId: this.targetId,
      labels: this.labels.filter((entry) => !entry.element.classList.contains("is-hidden")).length,
      fps: Math.round(this.fps),
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      surfaceSource: this.surfaceSource,
      simDate: this.simTimeMs,
      timeWarp: this.timeWarp,
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    window.removeEventListener("resize", this.onResize)
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown)
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp)
    this.renderer.domElement.removeEventListener("pointercancel", this.onPointerCancel)
    this.rig.dispose()
    for (const built of Object.values(this.regimes)) {
      this.scene.remove(built.group)
      disposeObject(built.group)
    }
    this.labelLayer.remove()
    this.veil.remove()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

function applyGroupOpacity(group: THREE.Group, weight: number) {
  if (weight >= 0.999) {
    if (group.userData.isDimmed) {
      group.userData.isDimmed = false
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const m of mats) {
            if (m.userData.baseOpacity !== undefined) {
              m.opacity = m.userData.baseOpacity as number
            }
          }
        }
      })
    }
    return
  }
  group.userData.isDimmed = true
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        if (m.userData.baseOpacity === undefined) {
          m.userData.baseOpacity = m.opacity ?? 1
        }
        m.opacity = (m.userData.baseOpacity as number) * weight
        m.transparent = true
      }
    }
  })
}
