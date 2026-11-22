import * as THREE from "three"
import gsap from "gsap"
import { getCameraDistanceForLogDist, LOG_MAX, LOG_MIN } from "./scaleController"

export interface CameraPose {
  target: THREE.Vector3
  yaw: number
  pitch: number
  distance: number
  logDist: number
}

interface TweenProxy {
  yaw: number
  pitch: number
  distance: number
  logDist: number
  tx: number
  ty: number
  tz: number
}

function nearestAngle(current: number, target: number): number {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta
}

/**
 * Continuous Damped Orbit & Logarithmic Zoom Camera Rig.
 *
 * Drives the continuous `logDist` coordinate (2.0 to 26.944) seamlessly
 * across all 25 orders of magnitude with smooth physical inertia,
 * two-finger pinch, mouse wheel, and drag-to-orbit controls.
 */
export class CameraRig {
  readonly state: CameraPose
  readonly desired: CameraPose
  private camera: THREE.PerspectiveCamera
  private element: HTMLElement
  private tweens: gsap.core.Tween[] = []
  private pointers = new Map<number, { x: number; y: number }>()
  private dragging = false
  private pinchDistance = 0
  private pinching = false
  private idle = 0
  private follow: (() => THREE.Vector3) | null = null
  private minDistance = 2
  private maxDistance = 2000
  private baseDistance = 200
  private surfaceDistanceLimit = Number.POSITIVE_INFINITY
  private disposed = false
  private dragDistance = 0
  private logDistVelocity = 0
  private lastInteractionTime = 0

  autoRotate = false
  onInteraction: (() => void) | null = null

  constructor(camera: THREE.PerspectiveCamera, element: HTMLElement, initialLogDist = 2.4) {
    this.camera = camera
    this.element = element
    this.state = {
      target: new THREE.Vector3(),
      yaw: 0.6,
      pitch: 0.25,
      distance: 240,
      logDist: initialLogDist,
    }
    this.desired = {
      target: new THREE.Vector3(),
      yaw: 0.6,
      pitch: 0.25,
      distance: 240,
      logDist: initialLogDist,
    }
    this.bind()
    this.apply()
  }

  setBounds(minDistance: number, maxDistance: number, baseDistance = maxDistance * 0.4) {
    this.minDistance = minDistance
    this.maxDistance = maxDistance
    this.baseDistance = baseDistance
  }

  getBaseDistance(): number {
    return this.baseDistance
  }

  /**
   * Camera distance for a depth, widened on narrow viewports. The surface
   * mosaic is a fixed region, so a portrait phone would otherwise frame a
   * blurry sliver of it instead of the same ground a desktop shows.
   */
  getFramedDistance(logDist: number): number {
    const base = getCameraDistanceForLogDist(logDist)
    if (logDist > 5) return base
    const correction = Math.max(1, 1.6 / Math.max(0.3, this.camera.aspect))
    // Only the surface zone is corrected, easing out as the globe fades in.
    const t = THREE.MathUtils.clamp((5 - logDist) / 0.8, 0, 1)
    const framed = base * (1 + (correction - 1) * (t * t * (3 - 2 * t)))
    // Never pull back past the edge of the fixed regional mosaic.
    return Math.min(framed, this.surfaceDistanceLimit)
  }

  setSurfaceDistanceLimit(distance: number) {
    this.surfaceDistanceLimit = distance
  }

  /** Re-apply the viewport-aware framing after a resize or rotation. */
  refreshFraming() {
    this.desired.distance = this.getFramedDistance(this.desired.logDist)
    this.state.distance = this.getFramedDistance(this.state.logDist)
  }

  get isInteracting(): boolean {
    return this.dragging || performance.now() - this.lastInteractionTime < 1200 || Math.abs(this.logDistVelocity) > 0.005
  }

  setLogDist(logDist: number, immediate = false) {
    const clamped = THREE.MathUtils.clamp(logDist, LOG_MIN, LOG_MAX)
    this.desired.logDist = clamped
    this.desired.distance = this.getFramedDistance(clamped)
    if (immediate) {
      this.state.logDist = clamped
      this.state.distance = this.desired.distance
      this.logDistVelocity = 0
    }
    this.lastInteractionTime = performance.now()
    this.onInteraction?.()
  }

  setPose(pose: Partial<CameraPose>, immediate = false) {
    if (pose.target) {
      this.desired.target.copy(pose.target)
      if (immediate) this.state.target.copy(pose.target)
    }
    if (pose.yaw !== undefined) {
      this.desired.yaw = pose.yaw
      if (immediate) this.state.yaw = pose.yaw
    }
    if (pose.pitch !== undefined) {
      const pitch = THREE.MathUtils.clamp(pose.pitch, -1.42, 1.42)
      this.desired.pitch = pitch
      if (immediate) this.state.pitch = pitch
    }
    if (pose.distance !== undefined) {
      const distance = THREE.MathUtils.clamp(pose.distance, this.minDistance, this.maxDistance)
      this.desired.distance = distance
      if (immediate) this.state.distance = distance
    }
    if (pose.logDist !== undefined) {
      const logDist = THREE.MathUtils.clamp(pose.logDist, LOG_MIN, LOG_MAX)
      this.desired.logDist = logDist
      if (immediate) {
        this.state.logDist = logDist
        this.logDistVelocity = 0
      }
    }
    if (immediate) this.apply()
  }

  flyTo(pose: Partial<CameraPose>, duration = 1.6, ease = "power3.inOut", onComplete?: () => void) {
    this.killTweens()
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      duration = 0.01
    }
    this.logDistVelocity = 0
    const target = pose.target ?? this.desired.target.clone()
    const proxy: TweenProxy = {
      yaw: this.desired.yaw,
      pitch: this.desired.pitch,
      distance: this.desired.distance,
      logDist: this.desired.logDist,
      tx: this.desired.target.x,
      ty: this.desired.target.y,
      tz: this.desired.target.z,
    }
    const end = {
      yaw: nearestAngle(this.desired.yaw, pose.yaw ?? this.desired.yaw),
      pitch: THREE.MathUtils.clamp(pose.pitch ?? this.desired.pitch, -1.42, 1.42),
      distance: THREE.MathUtils.clamp(pose.distance ?? this.desired.distance, this.minDistance, this.maxDistance),
      logDist: THREE.MathUtils.clamp(pose.logDist ?? this.desired.logDist, LOG_MIN, LOG_MAX),
      tx: target.x,
      ty: target.y,
      tz: target.z,
    }
    const tween = gsap.to(proxy, {
      ...end,
      duration: Math.max(0.01, duration),
      ease,
      overwrite: true,
      onUpdate: () => {
        this.desired.yaw = proxy.yaw
        this.desired.pitch = proxy.pitch
        this.desired.distance = proxy.distance
        this.desired.logDist = proxy.logDist
        this.desired.target.set(proxy.tx, proxy.ty, proxy.tz)
      },
      onComplete: () => {
        this.desired.yaw = proxy.yaw
        this.desired.pitch = proxy.pitch
        this.desired.distance = proxy.distance
        this.desired.logDist = proxy.logDist
        this.desired.target.set(proxy.tx, proxy.ty, proxy.tz)
        onComplete?.()
      },
    })
    this.tweens.push(tween)
    this.idle = 0
    return tween
  }

  followTarget(getter: (() => THREE.Vector3) | null) {
    this.follow = getter
    if (getter) this.desired.target.copy(getter())
  }

  getFollowTarget(): (() => THREE.Vector3) | null {
    return this.follow
  }

  zoomBy(factor: number) {
    this.killTweens()
    this.desired.distance = THREE.MathUtils.clamp(
      this.desired.distance * factor,
      this.minDistance,
      this.maxDistance,
    )
    this.idle = 0
  }

  resetIdle() {
    this.idle = 0
  }

  update(dt: number) {
    if (this.disposed) return

    // Continuous logarithmic zoom inertia
    if (Math.abs(this.logDistVelocity) > 0.0001) {
      this.desired.logDist = THREE.MathUtils.clamp(
        this.desired.logDist + this.logDistVelocity,
        LOG_MIN,
        LOG_MAX,
      )
      this.desired.distance = this.getFramedDistance(this.desired.logDist)
      this.logDistVelocity *= Math.exp(-dt * 8.5)
    } else {
      this.logDistVelocity = 0
    }

    // Smooth logDist spring
    this.state.logDist += (this.desired.logDist - this.state.logDist) * (1 - Math.exp(-dt * 9.5))

    if (this.follow) {
      const p = this.follow()
      this.desired.target.copy(p)
      this.state.target.lerp(p, 1 - Math.exp(-dt * 9))
    } else {
      this.state.target.lerp(this.desired.target, 1 - Math.exp(-dt * 8))
    }

    const damping = 1 - Math.exp(-dt * 8.5)
    let delta = (this.desired.yaw - this.state.yaw) % (Math.PI * 2)
    if (delta > Math.PI) delta -= Math.PI * 2
    if (delta < -Math.PI) delta += Math.PI * 2
    this.state.yaw += delta * damping
    this.state.pitch += (this.desired.pitch - this.state.pitch) * damping
    this.state.distance += (this.desired.distance - this.state.distance) * damping

    this.idle += dt
    if (this.autoRotate && !this.dragging && this.idle > 7 && this.tweens.length === 0) {
      this.desired.yaw += dt * 0.012
    }
    this.apply()
  }

  private apply() {
    const { target, yaw, pitch, distance } = this.state
    const cp = Math.cos(pitch)
    this.camera.position.set(
      target.x + distance * cp * Math.sin(yaw),
      target.y + distance * Math.sin(pitch),
      target.z + distance * cp * Math.cos(yaw),
    )
    this.camera.lookAt(target)
  }

  private bind() {
    this.element.addEventListener("pointerdown", this.onPointerDown)
    this.element.addEventListener("pointermove", this.onPointerMove)
    this.element.addEventListener("pointerup", this.onPointerUp)
    this.element.addEventListener("pointercancel", this.onPointerUp)
    this.element.addEventListener("wheel", this.onWheel, { passive: false })
    this.element.addEventListener("dblclick", this.onDoubleClick)
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size === 1) {
      this.pinching = false
      this.pinchDistance = 0
      this.dragDistance = 0
    } else {
      // A second finger starts a pinch: never treat this gesture as a tap.
      this.pinching = true
    }
    this.dragging = true
    this.idle = 0
    this.lastInteractionTime = performance.now()
    this.killTweens()
    this.element.setPointerCapture?.(event.pointerId)
    this.onInteraction?.()
  }

  private onPointerMove = (event: PointerEvent) => {
    const previous = this.pointers.get(event.pointerId)
    if (!previous) return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    // Pinch-to-zoom for touch screens
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (this.pinchDistance > 0) {
        const factor = distance / Math.max(1, this.pinchDistance)
        // Fingers apart zooms in (smaller logDist); together zooms out.
        const logDist = THREE.MathUtils.clamp(
          this.desired.logDist - Math.log2(factor) * 1.2,
          LOG_MIN,
          LOG_MAX,
        )
        this.desired.logDist = logDist
        this.desired.distance = this.getFramedDistance(logDist)
        this.logDistVelocity = 0
        this.lastInteractionTime = performance.now()
        this.onInteraction?.()
      }
      this.pinchDistance = distance
      return
    }

    const dx = event.clientX - previous.x
    const dy = event.clientY - previous.y
    this.dragDistance += Math.abs(dx) + Math.abs(dy)
    this.desired.yaw -= dx * 0.0055
    this.desired.pitch = THREE.MathUtils.clamp(this.desired.pitch + dy * 0.0045, -1.42, 1.42)
    this.lastInteractionTime = performance.now()
    this.onInteraction?.()
  }

  private onPointerUp = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId)
    if (this.pointers.size === 0) {
      this.dragging = false
      this.pinchDistance = 0
      this.element.releasePointerCapture?.(event.pointerId)
    }
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault()
    this.killTweens()
    // Smooth physical inertia for continuous logarithmic zoom
    const delta = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 120) * 0.0035
    this.logDistVelocity += delta
    this.lastInteractionTime = performance.now()
    this.onInteraction?.()
  }

  private onDoubleClick = () => {
    this.killTweens()
    // Glide one step deeper on double click
    this.logDistVelocity -= 0.6
    this.lastInteractionTime = performance.now()
    this.onInteraction?.()
  }

  private killTweens() {
    for (const tween of this.tweens) tween.kill()
    this.tweens = []
  }

  wasDrag(): boolean {
    return this.dragDistance > 5 || this.pinching
  }

  dispose() {
    this.disposed = true
    this.killTweens()
    this.element.removeEventListener("pointerdown", this.onPointerDown)
    this.element.removeEventListener("pointermove", this.onPointerMove)
    this.element.removeEventListener("pointerup", this.onPointerUp)
    this.element.removeEventListener("pointercancel", this.onPointerUp)
    this.element.removeEventListener("wheel", this.onWheel)
    this.element.removeEventListener("dblclick", this.onDoubleClick)
  }
}
