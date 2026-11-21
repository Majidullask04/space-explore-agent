import * as THREE from "three"
import gsap from "gsap"

export interface CameraPose {
  target: THREE.Vector3
  yaw: number
  pitch: number
  distance: number
}

interface TweenProxy {
  yaw: number
  pitch: number
  distance: number
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
 * Damped orbit rig. One regime-local frame at a time keeps every coordinate
 * near the origin, which is the floating-origin part of the scale engine.
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
  private idle = 0
  private follow: (() => THREE.Vector3) | null = null
  private minDistance = 2
  private maxDistance = 2000
  private baseDistance = 200
  private disposed = false
  private dragDistance = 0

  autoRotate = true
  onInteraction: (() => void) | null = null

  constructor(camera: THREE.PerspectiveCamera, element: HTMLElement) {
    this.camera = camera
    this.element = element
    this.state = {
      target: new THREE.Vector3(),
      yaw: 0.6,
      pitch: 0.25,
      distance: 240,
    }
    this.desired = {
      target: new THREE.Vector3(),
      yaw: 0.6,
      pitch: 0.25,
      distance: 240,
    }
    this.bind()
    this.apply()
  }

  setBounds(minDistance: number, maxDistance: number, baseDistance = maxDistance * 0.4) {
    this.minDistance = minDistance
    this.maxDistance = maxDistance
    this.baseDistance = baseDistance
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
    if (immediate) this.apply()
  }

  flyTo(pose: Partial<CameraPose>, duration = 1.6, ease = "power3.inOut", onComplete?: () => void) {
    this.killTweens()
    const target = pose.target ?? this.desired.target.clone()
    const proxy: TweenProxy = {
      yaw: this.desired.yaw,
      pitch: this.desired.pitch,
      distance: this.desired.distance,
      tx: this.desired.target.x,
      ty: this.desired.target.y,
      tz: this.desired.target.z,
    }
    const end = {
      yaw: nearestAngle(this.desired.yaw, pose.yaw ?? this.desired.yaw),
      pitch: THREE.MathUtils.clamp(pose.pitch ?? this.desired.pitch, -1.42, 1.42),
      distance: THREE.MathUtils.clamp(pose.distance ?? this.desired.distance, this.minDistance, this.maxDistance),
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
        this.desired.target.set(proxy.tx, proxy.ty, proxy.tz)
      },
      onComplete: () => {
        this.desired.yaw = proxy.yaw
        this.desired.pitch = proxy.pitch
        this.desired.distance = proxy.distance
        this.desired.target.set(proxy.tx, proxy.ty, proxy.tz)
        onComplete?.()
      },
    })
    this.tweens.push(tween)
    this.idle = 0
    return tween
  }

  /** Fly in from a wider, offset pose to a destination. */
  approach(pose: CameraPose, duration = 2.4) {
    const start: CameraPose = {
      target: pose.target.clone(),
      yaw: pose.yaw - 0.55,
      pitch: Math.min(0.95, pose.pitch + 0.3),
      distance: pose.distance * 2.6,
    }
    this.setPose(start, true)
    this.flyTo(pose, duration, "power2.inOut")
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
    if (this.follow) {
      const p = this.follow()
      this.desired.target.copy(p)
      this.state.target.lerp(p, 1 - Math.exp(-dt * 9))
    } else {
      this.state.target.lerp(this.desired.target, 1 - Math.exp(-dt * 8))
    }
    const damping = 1 - Math.exp(-dt * 8)
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
    this.dragging = true
    this.dragDistance = 0
    this.idle = 0
    this.killTweens()
    this.element.setPointerCapture?.(event.pointerId)
    this.onInteraction?.()
  }

  private onPointerMove = (event: PointerEvent) => {
    const previous = this.pointers.get(event.pointerId)
    if (!previous) return
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (this.pinchDistance > 0) {
        const factor = this.pinchDistance / Math.max(1, distance)
        this.desired.distance = THREE.MathUtils.clamp(
          this.desired.distance * factor,
          this.minDistance,
          this.maxDistance,
        )
      }
      this.pinchDistance = distance
      return
    }
    const dx = event.clientX - previous.x
    const dy = event.clientY - previous.y
    this.dragDistance += Math.abs(dx) + Math.abs(dy)
    this.desired.yaw -= dx * 0.0055
    this.desired.pitch = THREE.MathUtils.clamp(this.desired.pitch + dy * 0.0045, -1.42, 1.42)
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
    const factor = Math.exp(event.deltaY * 0.0011)
    this.zoomBy(factor)
  }

  private onDoubleClick = () => {
    this.flyTo({ distance: this.baseDistance, pitch: 0.22 }, 1.1)
  }

  private killTweens() {
    for (const tween of this.tweens) tween.kill()
    this.tweens = []
  }

  wasDrag(): boolean {
    return this.dragDistance > 5
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
