import * as THREE from "three"
import { SOLAR_SYSTEM_BODIES, INTERSTELLAR_BODIES, MILKY_WAY_BODIES, UNIVERSE_BODIES } from "../data/catalog"
import { metersToWorld } from "./scaleController"
import { planetTexture, dotTexture, sunTexture, starSpriteTexture } from "./textures"
import { createAtmosphere, createSun } from "./materials"

export interface BuiltGroup {
  group: THREE.Group
  bodies: Map<string, THREE.Object3D>
}

/**
 * Builds the procedural content for each scale regime. Each regime lives in
 * its own group that is shown/hidden as the camera crosses scale boundaries,
 * so we avoid float32 jitter from mixing wildly different magnitudes.
 */
export class SceneBuilder {
  private dot = dotTexture()

  buildEarthMap(_origin: { lat: number; lng: number }): BuiltGroup {
    const group = new THREE.Group()
    const bodies = new Map<string, THREE.Object3D>()

    // A simplified Earth surface centered at the user's origin.
    const radius = metersToWorld("earth_map", 5e6)
    const earthMat = new THREE.MeshPhongMaterial({
      color: "#0b2b4a",
      specular: new THREE.Color("#1a3f63"),
      shininess: 18,
    })
    const earth = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), earthMat)
    group.add(earth)

    // Clouds layer
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.01, 64, 64),
      new THREE.MeshLambertMaterial({ color: "#d8e6f2", transparent: true, opacity: 0.35 }),
    )
    group.add(clouds)

    // Atmosphere glow
    const atmos = createAtmosphere("#38bdf8", 1.1)
    atmos.scale.setScalar(radius * 1.15)
    group.add(atmos)

    // Origin marker
    const marker = this.buildOriginMarker()
    group.add(marker)
    bodies.set("origin", marker)

    return { group, bodies }
  }

  buildEarthOrbit(): BuiltGroup {
    const group = new THREE.Group()
    const bodies = new Map<string, THREE.Object3D>()

    // Earth
    const earthRadius = metersToWorld("earth_orbit", 3.2e6)
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius, 48, 48),
      new THREE.MeshPhongMaterial({
        map: planetTexture("#2d6b9e", 11),
        specular: new THREE.Color("#2b4d6f"),
        shininess: 14,
      }),
    )
    group.add(earth)
    bodies.set("earth", earth)

    // Atmosphere
    const atmos = createAtmosphere("#38bdf8", 1.3)
    atmos.scale.setScalar(earthRadius * 1.2)
    group.add(atmos)

    // Moon orbit
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius * 0.28, 24, 24),
      new THREE.MeshPhongMaterial({ color: "#b8b2a8", shininess: 4 }),
    )
    const moonOrbit = new THREE.Group()
    moon.position.x = metersToWorld("earth_orbit", 3.8e8)
    moonOrbit.add(moon)
    group.add(moonOrbit)
    bodies.set("moon", moon)
    bodies.set("moonOrbit", moonOrbit)

    // ISS line (simple orbit ring)
    const issRing = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(this.circlePoints(earthRadius * 1.08, 96)),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 }),
    )
    issRing.rotation.x = Math.PI / 2.4
    group.add(issRing)
    bodies.set("iss", issRing)

    return { group, bodies }
  }

  buildSolarSystem(): BuiltGroup {
    const group = new THREE.Group()
    const bodies = new Map<string, THREE.Object3D>()

    // Sun (world size is small relative to AU)
    const sunRadius = metersToWorld("solar_system", 6.9e8) * 3.2
    const sun = createSun(sunRadius, sunTexture(), this.dot)
    group.add(sun)
    bodies.set("sun", sun)

    for (const body of SOLAR_SYSTEM_BODIES) {
      if (body.id === "sun") continue
      const radius = Math.max(
        0.6,
        metersToWorld("solar_system", body.profile.radiusM * Math.SQRT2) * 1.6,
      )
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshPhongMaterial({
          color: body.profile.color,
          emissive: body.profile.emissive ? body.profile.color : "#000000",
          shininess: body.profile.emissive ? 0 : 12,
        }),
      )
      const orbitGroup = new THREE.Group()
      sphere.position.x = metersToWorld("solar_system", body.distFromOriginM)
      orbitGroup.add(sphere)
      group.add(orbitGroup)

      // Orbit path
      const orbitPath = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          this.circlePoints(metersToWorld("solar_system", body.distFromOriginM), 128),
        ),
        new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25 }),
      )
      group.add(orbitPath)

      bodies.set(body.id, orbitGroup)
      bodies.set(`${body.id}:surface`, sphere)
    }

    // Asteroid belt (instanced)
    group.add(this.buildAsteroidBelt())

    return { group, bodies }
  }

  buildInterstellar(): BuiltGroup {
    const group = new THREE.Group()
    const bodies = new Map<string, THREE.Object3D>()

    for (const body of INTERSTELLAR_BODIES) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 2000,
      )
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: starSpriteTexture(body.profile.color),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      sprite.scale.setScalar(body.profile.emissive ? 20 : 8)
      sprite.position.copy(pos)
      group.add(sprite)
      bodies.set(body.id, sprite)
    }

    // backdrop starfield
    group.add(this.buildStarfield(6000, 3000))

    return { group, bodies }
  }

  buildMilkyWay(): BuiltGroup {
    const group = new THREE.Group()
    const bodies = new Map<string, THREE.Object3D>()

    // Spiral galaxy particle disc
    group.add(this.buildGalaxyDisc())

    for (const body of MILKY_WAY_BODIES) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: starSpriteTexture(body.profile.color),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      sprite.scale.setScalar(body.marker === "core" ? 90 : 45)
      // Place landmark at a plausible world position along the disc
      const angle = Math.random() * Math.PI * 2
      sprite.position.set(Math.cos(angle) * 3000, (Math.random() - 0.5) * 300, Math.sin(angle) * 3000)
      group.add(sprite)
      bodies.set(body.id, sprite)
    }

    return { group, bodies }
  }

  buildUniverse(): BuiltGroup {
    const group = new THREE.Group()
    const bodies = new Map<string, THREE.Object3D>()

    // Cosmic web filaments — point cloud
    group.add(this.buildCosmicWeb())

    for (const body of UNIVERSE_BODIES) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: starSpriteTexture(body.profile.color),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      sprite.scale.setScalar(body.marker === "landmark" ? 140 : 80)
      const angle = Math.random() * Math.PI * 2
      sprite.position.set(Math.cos(angle) * 6000, (Math.random() - 0.5) * 1200, Math.sin(angle) * 6000)
      group.add(sprite)
      bodies.set(body.id, sprite)
    }

    return { group, bodies }
  }

  /** Builds a shared starfield shell. */
  buildStarfield(count: number, radius: number): THREE.Points {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const white = new THREE.Color("#f4f7fa")
    const blue = new THREE.Color("#9fc7ff")
    const warm = new THREE.Color("#ffd7a1")
    const pick = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const r = radius * (0.4 + Math.random() * 0.6)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const roll = Math.random()
      pick.copy(roll < 0.7 ? white : roll < 0.9 ? blue : warm)
      pick.multiplyScalar(0.5 + Math.random() * 0.5)
      colors[i * 3] = pick.r
      colors[i * 3 + 1] = pick.g
      colors[i * 3 + 2] = pick.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.6,
        map: this.dot,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
  }

  private buildAsteroidBelt(): THREE.Points {
    const count = 1200
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = metersToWorld("solar_system", 2.6e11) + Math.random() * 600
      const y = (Math.random() - 0.5) * 60
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: "#94a3b8",
        size: 0.8,
        map: this.dot,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    )
  }

  private buildGalaxyDisc(): THREE.Points {
    const count = 16000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const core = new THREE.Color("#ffe6a1")
    const arm = new THREE.Color("#9fc7ff")
    const dust = new THREE.Color("#6b7280")
    const pick = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const radius = Math.pow(Math.random(), 1.4) * 3800
      const arms = 4
      const armOffset = (i % arms) * (Math.PI * 2 / arms)
      const spin = radius * 0.004
      const angle = Math.random() * Math.PI * 2 + armOffset + spin
      const spread = 0.35 * (1 + radius / 3800)
      const y = (Math.random() - 0.5) * spread * 220
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(angle) * radius
      const t = radius / 3800
      pick.copy(core).lerp(arm, t * 0.7)
      if (Math.random() < 0.2) pick.copy(dust)
      colors[i * 3] = pick.r
      colors[i * 3 + 1] = pick.g
      colors[i * 3 + 2] = pick.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 1.2,
        map: this.dot,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
  }

  private buildCosmicWeb(): THREE.Points {
    const count = 8000
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Filament-like distribution: mostly along a few lines
      const filament = Math.floor(Math.random() * 5)
      const t = (Math.random() - 0.5) * 14000
      const base = filament * 3000
      positions[i * 3] = t * 0.8 + base
      positions[i * 3 + 1] = (Math.random() - 0.5) * 800
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14000
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: "#8a9bb8",
        size: 1.1,
        map: this.dot,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    )
  }

  private buildOriginMarker(): THREE.Group {
    const g = new THREE.Group()
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 48),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    )
    ring.rotation.x = -Math.PI / 2
    g.add(ring)
    const pin = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 1.4, 12),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    )
    pin.position.y = 0.7
    g.add(pin)
    return g
  }

  private circlePoints(radius: number, segments: number): THREE.Vector3[] {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    }
    return pts
  }
}
