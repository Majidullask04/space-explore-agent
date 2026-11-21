import * as THREE from "three"
import { BODIES, findBody } from "../data/bodies"
import type {
  Body,
  ExoplanetRecord,
  IssState,
  LayerState,
  Origin,
  StarRecord,
} from "../data/types"
import {
  AU_KM,
  PLANET_ELEMENTS,
  bvToRgb,
  eclipticToScene,
  equatorialToGalactic,
  galacticPosition,
  planetOrbitAu,
  planetPositionAu,
  raDecToVector,
  subsolarPoint,
} from "../lib/astro"
import { formatDistanceKm, formatFixed } from "../lib/format"
import {
  createAtmosphereMaterial,
  createCloudMaterial,
  createEarthMaterial,
  createSunMaterial,
  loadEarthTextures,
} from "./earthMaterial"
import {
  buildGibsMosaic,
  cmbTexture,
  cropTextureRegion,
  galaxyTexture,
  nebulaSpriteTexture,
  ringAlphaTexture,
  texture,
} from "./textures"
import {
  circlePoints,
  compressedAu,
  createGlow,
  createHairline,
  createMarker,
  createOriginMarker,
  createStarPoints,
  gaussian,
  geoToSphere,
  logDistance,
  seededRandom,
  type StarPoint,
} from "./helpers"

export interface LabelSpec {
  id: string
  name: string
  sub?: string
  bodyId?: string
  kind?: string
  priority?: number
  maxCameraDistance?: number
  minCameraDistance?: number
  getPosition: () => THREE.Vector3
  getSub?: (ctx: UpdateContext) => string | undefined
}

export interface UpdateContext {
  date: Date
  dt: number
  iss: IssState | null
  origin: Origin
  layers: LayerState
}

export interface BuiltRegime {
  group: THREE.Group
  bodies: Map<string, THREE.Object3D>
  labels: LabelSpec[]
  update?: (ctx: UpdateContext) => void
  focusDistance?: Record<string, number>
}

const PLANET_IDS = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const

const PLANET_TEXTURES: Record<string, string> = {
  mercury: "/textures/mercury.jpg",
  venus: "/textures/venus.jpg",
  earth: "/textures/earth_day.jpg",
  mars: "/textures/mars.jpg",
  jupiter: "/textures/jupiter.jpg",
  saturn: "/textures/saturn.jpg",
  uranus: "/textures/uranus.jpg",
  neptune: "/textures/neptune.jpg",
  pluto: "/textures/pluto.jpg",
  moon: "/textures/moon.jpg",
}

const NEBULA_IMAGES: Record<string, string> = {
  "orion-nebula": "/nasa/orion-nebula.jpg",
  "eagle-nebula": "/nasa/eagle.jpg",
  "crab-nebula": "/nasa/crab.jpg",
  "carina-nebula": "/nasa/carina.jpg",
}

const MILKY_WAY_SCALE = 1 / 500
const UNIVERSE_MIN_LY = 1e6

function visualPlanetRadius(id: string): number {
  const km = PLANET_ELEMENTS[id]?.radiusKm ?? 6378
  return 1.35 + Math.log10(km / 1000) * 1.25
}

function labelFor(
  id: string,
  name: string,
  object: THREE.Object3D,
  options: Partial<LabelSpec> = {},
): LabelSpec {
  return {
    id,
    name,
    bodyId: options.bodyId ?? id,
    ...options,
    getPosition: () => object.getWorldPosition(new THREE.Vector3()),
  }
}

function registerBody(
  group: THREE.Group,
  bodies: Map<string, THREE.Object3D>,
  object: THREE.Object3D,
  id: string,
  focusDistance?: number,
) {
  object.userData.bodyId = id
  if (focusDistance !== undefined) object.userData.focusDistance = focusDistance
  group.add(object)
  bodies.set(id, object)
}

function surfaceBounds(origin: Origin) {
  const spanLat = 9
  const spanLon = 14
  return {
    latMin: Math.max(-82, origin.lat - spanLat / 2),
    latMax: Math.min(82, origin.lat + spanLat / 2),
    lonMin: Math.max(-180, origin.lng - spanLon / 2),
    lonMax: Math.min(180, origin.lng + spanLon / 2),
  }
}

export class SceneBuilder {
  private stars: StarRecord[]
  private earth = loadEarthTextures()
  private surfaceSource: "gibs" | "fallback" | "none" = "none"
  onSurfaceSource?: (source: "gibs" | "fallback") => void

  constructor(stars: StarRecord[]) {
    this.stars = stars
  }

  setStars(stars: StarRecord[]) {
    this.stars = stars
  }

  /* ------------------------------------------------------------------ */
  /* Surface                                                             */
  /* ------------------------------------------------------------------ */

  buildSurface(origin: Origin): BuiltRegime {
    const group = new THREE.Group()
    group.name = "surface"
    const bodies = new Map<string, THREE.Object3D>()
    const bounds = surfaceBounds(origin)
    const width = 1300
    const height = 1300
    const fallback = cropTextureRegion(texture("/textures/earth_day.jpg"), bounds)
    fallback.userData.owned = true
    const geometry = new THREE.PlaneGeometry(width, height, 72, 72)
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const curve = -0.000055 * (x * x + y * y)
      positions.setZ(i, curve)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    const material = new THREE.MeshBasicMaterial({
      map: fallback,
      color: new THREE.Color("#eef4fb"),
      toneMapped: false,
    })
    const plane = new THREE.Mesh(geometry, material)
    plane.userData.bodyId = "earth"
    group.add(plane)

    const markerX = ((origin.lng - (bounds.lonMin + bounds.lonMax) / 2) / (bounds.lonMax - bounds.lonMin)) * width
    const markerY = ((origin.lat - (bounds.latMin + bounds.latMax) / 2) / (bounds.latMax - bounds.latMin)) * height
    const marker = createOriginMarker("#38bdf8", 15)
    marker.position.set(markerX, markerY, 5)
    group.add(marker)

    const label = labelFor("origin", origin.label, marker, {
      bodyId: "earth",
      kind: "origin",
      sub: "YOUR LOCATION",
      priority: 10,
    })
    const labels = [label]
    const built: BuiltRegime = {
      group,
      bodies,
      labels,
      focusDistance: { earth: 620 },
      update: () => {
        // The mosaic is a static local plate; only the marker is anchored.
      },
    }

    void this.refreshSurface(built, origin, plane)
    return built
  }

  private async refreshSurface(
    built: BuiltRegime,
    origin: Origin,
    plane: THREE.Mesh,
  ) {
    try {
      const mosaic = await buildGibsMosaic(origin.lat, origin.lng, 9, 14)
      const material = plane.material as THREE.MeshBasicMaterial
      const previous = material.map
      material.map = mosaic.texture
      material.needsUpdate = true
      if (previous?.userData?.owned) previous.dispose()
      this.surfaceSource = mosaic.source
      this.onSurfaceSource?.(mosaic.source)
      built.group.userData.surfaceSource = mosaic.source
    } catch {
      this.surfaceSource = "fallback"
      this.onSurfaceSource?.("fallback")
    }
  }

  /* ------------------------------------------------------------------ */
  /* Orbit                                                               */
  /* ------------------------------------------------------------------ */

  buildOrbit(): BuiltRegime {
    const group = new THREE.Group()
    group.name = "orbit"
    const bodies = new Map<string, THREE.Object3D>()
    const radius = 100
    const sunDirection = geoToSphere(12, 0)
    const earthMaterial = createEarthMaterial(this.earth, sunDirection, {
      nightIntensity: 1.05,
      exposure: 1.06,
    })
    const earth = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), earthMaterial)
    earth.userData.bodyId = "earth"
    earth.userData.focusDistance = 330
    group.add(earth)
    bodies.set("earth", earth)

    const cloudMaterial = createCloudMaterial(this.earth.clouds, sunDirection, 0.72)
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.006, 96, 96), cloudMaterial)
    clouds.userData.bodyId = "earth"
    group.add(clouds)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.075, 72, 72),
      createAtmosphereMaterial(sunDirection, "#3b82f6", 1.05),
    )
    group.add(atmosphere)

    const equator = createHairline(circlePoints(radius * 1.002, 256, "xz"), "#94a3b8", 0.08, true)
    equator.userData.layer = "grid"
    group.add(equator)

    const issOrbit = createHairline(circlePoints(radius * 1.066, 256, "xz"), "#38bdf8", 0.22, true)
    issOrbit.rotation.x = THREE.MathUtils.degToRad(51.6)
    issOrbit.userData.layer = "orbits"
    group.add(issOrbit)

    const issMarker = new THREE.Group()
    issMarker.userData.layer = "spacecraft"
    const issRing = createMarker("#f59e0b", 4.2, 0.95)
    issMarker.add(issRing)
    issMarker.add(createGlow("#f59e0b", 2.4, 0.55, true))
    registerBody(group, bodies, issMarker, "iss", 34)

    const originMarker = createOriginMarker("#38bdf8", 3.6)
    group.add(originMarker)
    const originLabel = labelFor("origin", "Your location", originMarker, {
      bodyId: "earth",
      kind: "origin",
      sub: "SURFACE ORIGIN",
      priority: 9,
    })

    const earthLabel = labelFor("earth", "Earth", earth, {
      kind: "planet",
      sub: "BLUE MARBLE",
      priority: 8,
    })
    const issLabel: LabelSpec = {
      id: "iss",
      name: "ISS",
      bodyId: "iss",
      kind: "spacecraft",
      priority: 10,
      getPosition: () => issMarker.getWorldPosition(new THREE.Vector3()),
      getSub: (ctx) =>
        ctx.iss
          ? `${formatFixed(ctx.iss.altitudeKm, 0)} km · ${formatFixed(ctx.iss.velocityKmH, 0)} km/h`
          : "LIVE TRACK",
    }

    const sky = this.buildSky(radius * 26, 6200, 0.8, 5)
    sky.userData.layer = "constellations"
    group.add(sky)

    const update = (ctx: UpdateContext) => {
      const ss = subsolarPoint(ctx.date)
      const dir = geoToSphere(ss.lat, ss.lon)
      ;(earthMaterial.uniforms.sunDirection.value as THREE.Vector3).copy(dir)
      ;(cloudMaterial.uniforms.sunDirection.value as THREE.Vector3).copy(dir)
      const atmoMaterial = atmosphere.material as THREE.ShaderMaterial
      ;(atmoMaterial.uniforms.sunDirection.value as THREE.Vector3).copy(dir)
      ;(cloudMaterial.uniforms.opacity.value as number) = 0.66
      this.earth.clouds.offset.x = (ctx.date.getTime() / 1000 / 86400) * 0.0025
      this.earth.clouds.offset.y = 0
      if (ctx.iss) {
        const alt = radius * (1 + ctx.iss.altitudeKm / 6378.137)
        issMarker.position.copy(geoToSphere(ctx.iss.lat, ctx.iss.lng, alt))
        const issOrbitRotation = THREE.MathUtils.degToRad(51.6)
        issOrbit.rotation.x = issOrbitRotation
      } else {
        issMarker.position.copy(geoToSphere(23.18, 78.94, radius * 1.066))
      }
      originMarker.position.copy(geoToSphere(ctx.origin.lat, ctx.origin.lng, radius * 1.008))
      originMarker.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        originMarker.position.clone().normalize(),
      )
    }
    update({
      date: new Date(),
      dt: 0,
      iss: null,
      origin: { lat: 0, lng: 0, label: "Origin", source: "default" },
      layers: { orbits: true, labels: true, constellations: false, spacecraft: true, belts: true, grid: false },
    })

    return {
      group,
      bodies,
      labels: [earthLabel, originLabel, issLabel],
      update,
      focusDistance: { earth: 330, iss: 34, origin: 330 },
    }
  }

  /* ------------------------------------------------------------------ */
  /* Solar system                                                        */
  /* ------------------------------------------------------------------ */

  buildSolarSystem(): BuiltRegime {
    const group = new THREE.Group()
    group.name = "solar_system"
    const bodies = new Map<string, THREE.Object3D>()
    const labels: LabelSpec[] = []

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 64, 64),
      createSunMaterial(texture("/textures/sun.jpg")),
    )
    sun.userData.bodyId = "sun"
    sun.userData.focusDistance = 46
    group.add(sun)
    bodies.set("sun", sun)
    group.add(createGlow("#ffd7a1", 30, 0.55))
    group.add(createGlow("#ff9d5c", 58, 0.22))
    labels.push(
      labelFor("sun", "Sun", sun, { kind: "star", sub: "G2V · 5,772 K", priority: 10 }),
    )

    const light = new THREE.PointLight("#fff2dd", 4.6, 0, 0)
    group.add(light)
    group.add(new THREE.AmbientLight("#0b1624", 0.38))

    const planetGroups = new Map<string, THREE.Group>()
    const earthMaterial = createEarthMaterial(this.earth, new THREE.Vector3(1, 0, 0), {
      nightIntensity: 0.9,
      exposure: 1,
    })
    const earthCloudMaterial = createCloudMaterial(this.earth.clouds, new THREE.Vector3(1, 0, 0), 0.3)

    for (const id of PLANET_IDS) {
      const body = findBody(id)
      const orbitGroup = new THREE.Group()
      const radius = visualPlanetRadius(id)
      const holder = new THREE.Group()
      let mesh: THREE.Mesh
      if (id === "earth") {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), earthMaterial)
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, 48, 48), earthCloudMaterial)
        cloud.userData.bodyId = "earth"
        holder.add(cloud)
      } else {
        const map = texture(PLANET_TEXTURES[id] ?? PLANET_TEXTURES.moon)
        const material = new THREE.MeshStandardMaterial({
          map,
          roughness: 0.94,
          metalness: 0,
        })
        mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), material)
      }
      mesh.userData.bodyId = id
      holder.add(mesh)
      const tilt = id === "uranus" ? 97.8 : id === "earth" ? 23.44 : id === "saturn" ? 26.7 : 0
      holder.rotation.z = THREE.MathUtils.degToRad(tilt)
      orbitGroup.add(holder)
      orbitGroup.userData.bodyId = id
      orbitGroup.userData.focusDistance = id === "earth" ? 22 : Math.max(14, radius * 6)
      group.add(orbitGroup)
      bodies.set(id, orbitGroup)
      planetGroups.set(id, orbitGroup)

      if (id === "saturn") {
        const inner = radius * 1.35
        const outer = radius * 2.35
        const ringMaterial = new THREE.ShaderMaterial({
          uniforms: {
            ringMap: { value: ringAlphaTexture() },
            inner: { value: inner },
            outer: { value: outer },
            opacity: { value: 0.92 },
          },
          vertexShader: /* glsl */ `
            varying vec2 vPos;
            void main() {
              vPos = position.xy;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform sampler2D ringMap;
            uniform float inner;
            uniform float outer;
            uniform float opacity;
            varying vec2 vPos;
            void main() {
              float r = length(vPos);
              float t = (r - inner) / (outer - inner);
              if (t < 0.0 || t > 1.0) discard;
              vec4 c = texture2D(ringMap, vec2(t, 0.5));
              gl_FragColor = vec4(c.rgb, c.a * opacity);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }
          `,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 192, 1), ringMaterial)
        ring.rotation.x = -Math.PI / 2
        ring.userData.bodyId = "saturn"
        holder.add(ring)
      }

      const orbitLine = createHairline(
        planetOrbitAu(id, 256).map((p) => compressedAu(p)),
        id === "earth" ? "#38bdf8" : "#94a3b8",
        id === "earth" ? 0.3 : 0.16,
        true,
      )
      orbitLine.userData.layer = "orbits"
      group.add(orbitLine)

      const label: LabelSpec = {
        id,
        name: body?.name ?? id,
        bodyId: id,
        kind: "planet",
        priority: body?.notable ? 8 : 4,
        maxCameraDistance: 900,
        getPosition: () => orbitGroup.getWorldPosition(new THREE.Vector3()),
        getSub: (ctx) => {
          const earthPos = planetPositionAu("earth", ctx.date)
          const pos = planetPositionAu(id, ctx.date)
          const au = Math.hypot(pos.x - earthPos.x, pos.y - earthPos.y, pos.z - earthPos.z)
          return `${formatFixed(au, au < 10 ? 2 : 1)} AU · ${formatDistanceKm(au * AU_KM)}`
        },
      }
      labels.push(label)
    }

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 32, 32),
      new THREE.MeshStandardMaterial({ map: texture("/textures/moon.jpg"), roughness: 1 }),
    )
    moon.userData.bodyId = "moon"
    const moonPivot = new THREE.Group()
    moon.position.set(6.2, 0, 0)
    moonPivot.add(moon)
    planetGroups.get("earth")!.add(moonPivot)
    bodies.set("moon", moon)
    labels.push({
      id: "moon",
      name: "Moon",
      bodyId: "moon",
      kind: "moon",
      priority: 5,
      maxCameraDistance: 140,
      getPosition: () => moon.getWorldPosition(new THREE.Vector3()),
      getSub: () => "384,400 km · distance compressed",
    })

    const jupiter = planetGroups.get("jupiter")!
    const jupiterMoons: Array<[string, string, number, number]> = [
      ["io", "#d8c17a", 5.3, 1.3],
      ["europa", "#d8d2c0", 6.5, 1.15],
      ["ganymede", "#a89e90", 7.9, 1.45],
      ["callisto", "#8c8478", 9.6, 1.25],
    ]
    const jupiterPivots: Array<{ pivot: THREE.Group; period: number }> = []
    for (const [id, color, distance, size] of jupiterMoons) {
      const pivot = new THREE.Group()
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size * 0.55, 24, 24),
        new THREE.MeshStandardMaterial({ color, roughness: 1 }),
      )
      mesh.position.set(distance, 0, 0)
      mesh.userData.bodyId = id
      pivot.add(mesh)
      jupiter.add(pivot)
      bodies.set(id, mesh)
      labels.push({
        id,
        name: findBody(id)?.name ?? id,
        bodyId: id,
        kind: "moon",
        priority: 2,
        maxCameraDistance: 90,
        getPosition: () => mesh.getWorldPosition(new THREE.Vector3()),
      })
      jupiterPivots.push({ pivot, period: 1.77 + distance * 0.32 })
    }

    const asteroidBelt = this.buildBelt(1800, 2.08, 3.3, "#94a3b8", 0.42, 11)
    asteroidBelt.userData.layer = "belts"
    asteroidBelt.userData.bodyId = "asteroid-belt"
    group.add(asteroidBelt)
    bodies.set("asteroid-belt", asteroidBelt)
    labels.push({
      id: "asteroid-belt",
      name: "Asteroid Belt",
      bodyId: "asteroid-belt",
      kind: "belt",
      priority: 3,
      getPosition: () => compressedAu({ x: 2.7, y: 0, z: 0 }),
    })

    const kuiper = this.buildBelt(2600, 30, 50, "#64748b", 0.3, 16)
    kuiper.userData.bodyId = "kuiper-belt"
    kuiper.userData.layer = "belts"
    group.add(kuiper)
    bodies.set("kuiper-belt", kuiper)
    labels.push({
      id: "kuiper-belt",
      name: "Kuiper Belt",
      bodyId: "kuiper-belt",
      kind: "belt",
      priority: 2,
      getPosition: () => compressedAu({ x: 40, y: 0, z: 0 }),
    })

    const sky = this.buildSky(2600, 6500, 0.7, 4.5)
    sky.userData.layer = "constellations"
    group.add(sky)

    const update = (ctx: UpdateContext) => {
      const date = ctx.date
      const earthPos = compressedAu(planetPositionAu("earth", date))
      const earthSun = earthPos.clone().negate().normalize()
      ;(earthMaterial.uniforms.sunDirection.value as THREE.Vector3).copy(earthSun)
      ;(earthCloudMaterial.uniforms.sunDirection.value as THREE.Vector3).copy(earthSun)
      const days = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000
      for (const id of PLANET_IDS) {
        const orbitGroup = planetGroups.get(id)
        if (!orbitGroup) continue
        orbitGroup.position.copy(compressedAu(planetPositionAu(id, date)))
        const holder = orbitGroup.children[0]
        if (holder) holder.rotation.y = (days / (PLANET_ELEMENTS[id]?.periodDays ?? 365)) * Math.PI * 2
      }
      moonPivot.rotation.y = (days / 27.3217) * Math.PI * 2 + 0.6
      for (let i = 0; i < jupiterPivots.length; i++) {
        const { pivot, period } = jupiterPivots[i]
        pivot.rotation.y = (days / period) * Math.PI * 2 + i * 1.2
      }
      sun.rotation.y = (days / 25.38) * Math.PI * 2
    }
    update({
      date: new Date(),
      dt: 0,
      iss: null,
      origin: { lat: 0, lng: 0, label: "Origin", source: "default" },
      layers: { orbits: true, labels: true, constellations: false, spacecraft: true, belts: true, grid: false },
    })

    return {
      group,
      bodies,
      labels,
      update,
      focusDistance: {
        sun: 46,
        mercury: 15,
        venus: 16,
        earth: 22,
        moon: 8,
        mars: 16,
        jupiter: 28,
        saturn: 30,
        uranus: 22,
        neptune: 22,
        pluto: 15,
        "asteroid-belt": 160,
        "kuiper-belt": 240,
      },
    }
  }

  private buildBelt(
    count: number,
    innerAu: number,
    outerAu: number,
    color: string,
    opacity: number,
    thickness: number,
  ): THREE.Points {
    const random = seededRandom(innerAu * 1000 + count)
    const points: StarPoint[] = []
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2
      const r = innerAu + random() * (outerAu - innerAu)
      const y = (random() - 0.5) * thickness
      const p = compressedAu({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r })
      points.push({
        x: p.x,
        y,
        z: p.z,
        r: c.r * (0.65 + random() * 0.35),
        g: c.g * (0.65 + random() * 0.35),
        b: c.b * (0.65 + random() * 0.35),
        size: 0.5 + random() * 0.7,
      })
    }
    const cloud = createStarPoints(points, { scale: 90, opacity, minSize: 0.6, maxSize: 2.2 })
    cloud.frustumCulled = false
    return cloud
  }

  /* ------------------------------------------------------------------ */
  /* Interstellar                                                        */
  /* ------------------------------------------------------------------ */

  buildInterstellar(exoplanets: ExoplanetRecord[] = []): BuiltRegime {
    const group = new THREE.Group()
    group.name = "interstellar"
    const bodies = new Map<string, THREE.Object3D>()
    const labels: LabelSpec[] = []

    const local: StarPoint[] = []
    const distant: StarPoint[] = []
    for (const star of this.stars) {
      if (!Number.isFinite(star.raDeg) || !Number.isFinite(star.decDeg)) continue
      if (star.distPc <= 0) continue
      const dir = raDecToVector(star.raDeg, star.decDeg)
      const [r, g, b] = bvToRgb(star.bv)
      const mag = Math.max(-1.5, Math.min(12, star.mag))
      if (star.distPc < 400 && mag < 10.5) {
        const d = star.distPc * 3.26156
        local.push({
          x: dir.x * d,
          y: dir.y * d,
          z: dir.z * d,
          r,
          g,
          b,
          size: Math.max(0.5, 3.4 - mag * 0.29),
        })
      } else if (mag < 8.2) {
        distant.push({
          x: dir.x * 2200,
          y: dir.y * 2200,
          z: dir.z * 2200,
          r,
          g,
          b,
          size: Math.max(0.5, 2.4 - mag * 0.2),
        })
      }
    }
    group.add(createStarPoints(local, { scale: 105, opacity: 0.92, minSize: 1, maxSize: 9 }))
    group.add(createStarPoints(distant, { scale: 5200, opacity: 0.62, minSize: 0.8, maxSize: 5 }))

    const sunGlow = createGlow("#ffd7a1", 5.5, 0.95)
    group.add(sunGlow)
    const sunMarker = createOriginMarker("#38bdf8", 2.2)
    group.add(sunMarker)
    labels.push({
      id: "sun",
      name: "Sun",
      bodyId: "sun",
      kind: "star",
      sub: "YOU ARE HERE",
      priority: 10,
      getPosition: () => sunMarker.getWorldPosition(new THREE.Vector3()),
    })

    const scaleRings = [10, 25, 50, 100]
    for (const ly of scaleRings) {
      const ring = createHairline(circlePoints(ly, 160, "xz"), "#94a3b8", 0.11, true)
      ring.userData.layer = "grid"
      group.add(ring)
      labels.push({
        id: `scale-${ly}`,
        name: `${ly} ly`,
        kind: "scale",
        priority: 1,
        maxCameraDistance: 900,
        getPosition: () => new THREE.Vector3(ly, 0, 0),
      })
    }

    const exoGroup = new THREE.Group()
    exoGroup.name = "exoplanets"
    group.add(exoGroup)
    this.populateExoplanets(exoGroup, exoplanets)

    const interstellarBodies = BODIES.filter((b) => b.regime === "interstellar")
    let exoIndex = 0
    for (const body of interstellarBodies) {
      if (body.raDeg === undefined || body.decDeg === undefined || body.distLy === undefined) continue
      const dirVec = raDecToVector(body.raDeg, body.decDeg)
      const dir = new THREE.Vector3(dirVec.x, dirVec.y, dirVec.z)
      let position = dir.clone().multiplyScalar(body.distLy)
      if (body.kind === "exoplanet") {
        const host = interstellarBodies.find(
          (b) => b.kind === "star" && b.raDeg === body.raDeg && b.decDeg === body.decDeg,
        )
        if (host && host.distLy) position = dir.clone().multiplyScalar(host.distLy)
        const angle = exoIndex * 2.4
        position.x += Math.cos(angle) * 0.55
        position.y += Math.sin(angle) * 0.55
        exoIndex++
      }
      const size = body.kind === "star" ? 1.1 + (body.size ?? 0.1) * 7 : 0.9
      const marker = createMarker(body.color, size, body.kind === "exoplanet" ? 0.75 : 0.95)
      marker.position.copy(position)
      marker.userData.bodyId = body.id
      marker.userData.focusDistance = 18
      group.add(marker)
      bodies.set(body.id, marker)
      labels.push({
        id: body.id,
        name: body.name,
        bodyId: body.id,
        kind: body.kind,
        priority: body.notable ? 8 : 4,
        maxCameraDistance: 1800,
        getPosition: () => marker.getWorldPosition(new THREE.Vector3()),
        getSub: () =>
          body.distLy
            ? `${formatFixed(body.distLy, body.distLy < 10 ? 2 : 0)} ly`
            : undefined,
      })
    }

    return {
      group,
      bodies,
      labels,
      focusDistance: {
        sun: 40,
        "proxima-centauri": 14,
        "alpha-centauri": 14,
        "barnard-star": 14,
        sirius: 16,
        "tau-ceti": 16,
        "trappist-1": 16,
        "trappist-1e": 12,
        "kepler-186f": 18,
        "k2-18b": 16,
        "toi-700d": 16,
        betelgeuse: 24,
        vega: 16,
        arcturus: 18,
        rigel: 24,
        polaris: 22,
      },
    }
  }

  populateExoplanets(group: THREE.Group, records: ExoplanetRecord[]) {
    while (group.children.length) {
      const child = group.children.pop()!
      child.traverse((object) => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material?.dispose()
      })
    }
    if (!records.length) return
    const points: StarPoint[] = []
    for (const record of records) {
      if (!Number.isFinite(record.distPc) || record.distPc <= 0 || record.distPc > 400) continue
      const dir = raDecToVector(record.raDeg, record.decDeg)
      const d = record.distPc * 3.26156
      points.push({
        x: dir.x * d,
        y: dir.y * d,
        z: dir.z * d,
        r: 0.96,
        g: 0.68,
        b: 0.25,
        size: 0.8,
      })
    }
    if (points.length) {
      const cloud = createStarPoints(points, { scale: 70, opacity: 0.7, minSize: 0.7, maxSize: 3.2 })
      cloud.userData.bodyId = "exoplanet-field"
      group.add(cloud)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Milky Way                                                           */
  /* ------------------------------------------------------------------ */

  buildMilkyWay(): BuiltRegime {
    const group = new THREE.Group()
    group.name = "milky_way"
    const bodies = new Map<string, THREE.Object3D>()
    const labels: LabelSpec[] = []
    const random = seededRandom(1977)

    const galaxy = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 130),
      new THREE.MeshBasicMaterial({
        map: galaxyTexture(2048, 7),
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    )
    galaxy.rotation.x = -Math.PI / 2
    galaxy.position.y = -0.3
    group.add(galaxy)

    const points: StarPoint[] = []
    for (let i = 0; i < 28000; i++) {
      const r = Math.pow(random(), 0.58) * 62
      const arm = i % 4
      const base = (arm / 4) * Math.PI * 2
      const spiral = Math.log(Math.max(6, r) / 14) * 2.2
      const spread = (0.12 + (r / 62) * 0.24) * (random() - 0.5)
      const angle = base + spiral + spread
      const jitter = (random() - 0.5) * (0.8 + (r / 62) * 3.2)
      const x = Math.cos(angle) * r + jitter
      const z = Math.sin(angle) * r + jitter * 0.5
      const y = gaussian(random) * (0.35 + (r / 62) * 0.8)
      const t = r / 62
      const warm = t < 0.18
      const color = new THREE.Color(warm ? "#ffe2b0" : random() < 0.2 ? "#c9dcff" : "#eef3ff")
      points.push({
        x,
        y,
        z,
        r: color.r,
        g: color.g,
        b: color.b,
        size: 0.5 + random() * (warm ? 1.2 : 0.8),
      })
    }
    group.add(createStarPoints(points, { scale: 110, opacity: 0.8, minSize: 0.6, maxSize: 4 }))
    group.add(createGlow("#ffd9a0", 30, 0.9))
    group.add(createGlow("#fff1d6", 13, 0.9, true))

    const sgr = new THREE.Group()
    const hole = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 32, 32),
      new THREE.MeshBasicMaterial({ color: "#000000" }),
    )
    sgr.add(hole)
    sgr.add(createMarker("#f59e0b", 5.6, 0.9))
    sgr.add(createGlow("#f59e0b", 10, 0.3))
    sgr.userData.bodyId = "sagittarius-a-star"
    group.add(sgr)
    bodies.set("sagittarius-a-star", sgr)
    labels.push({
      id: "sagittarius-a-star",
      name: "Sagittarius A*",
      bodyId: "sagittarius-a-star",
      kind: "blackhole",
      sub: "4.3 million solar masses",
      priority: 9,
      getPosition: () => sgr.getWorldPosition(new THREE.Vector3()),
    })

    const sun = createOriginMarker("#38bdf8", 2.4)
    sun.position.set(26000 * MILKY_WAY_SCALE, 0, 0)
    group.add(sun)
    labels.push({
      id: "sun",
      name: "Sun",
      bodyId: "sun",
      kind: "star",
      sub: "YOU ARE HERE",
      priority: 10,
      getPosition: () => sun.getWorldPosition(new THREE.Vector3()),
    })
    const sunOrbitRing = createHairline(
      circlePoints(26000 * MILKY_WAY_SCALE, 256, "xz"),
      "#38bdf8",
      0.09,
      true,
    )
    sunOrbitRing.userData.layer = "grid"
    group.add(sunOrbitRing)

    const milkyBodies = BODIES.filter((b) => b.regime === "milky_way" && b.id !== "sagittarius-a-star")
    for (const body of milkyBodies) {
      let position: THREE.Vector3
      if (body.id === "orion-arm") {
        position = new THREE.Vector3(42, 0.2, 12)
      } else if (body.raDeg !== undefined && body.decDeg !== undefined && body.distLy) {
        const gp = galacticPosition(body.raDeg, body.decDeg, body.distLy)
        position = new THREE.Vector3(gp.x, gp.y, gp.z).multiplyScalar(MILKY_WAY_SCALE)
      } else {
        position = new THREE.Vector3(38, 1, -8)
      }
      const marker = new THREE.Group()
      marker.position.copy(position)
      marker.userData.bodyId = body.id
      marker.userData.focusDistance = 28
      if (body.kind === "nebula") {
        const image = NEBULA_IMAGES[body.id]
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: image
              ? texture(image)
              : nebulaSpriteTexture(body.color, body.id.length * 13),
            color: new THREE.Color("#ffffff"),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        )
        const size = body.notable ? 13 : 9
        sprite.scale.set(size, size, 1)
        marker.add(sprite)
        marker.add(createMarker(body.color, 2.4, 0.8))
      } else {
        marker.add(createMarker(body.color, 2.8, 0.9))
        marker.add(createGlow(body.color, 4.2, 0.18))
      }
      group.add(marker)
      bodies.set(body.id, marker)
      labels.push({
        id: body.id,
        name: body.name,
        bodyId: body.id,
        kind: body.kind,
        priority: body.notable ? 7 : 3,
        maxCameraDistance: 500,
        getPosition: () => marker.getWorldPosition(new THREE.Vector3()),
        getSub: () => (body.distLy ? `${formatFixed(body.distLy / 1000, 1)} kly` : undefined),
      })
    }

    return {
      group,
      bodies,
      labels,
      focusDistance: {
        sun: 40,
        "sagittarius-a-star": 24,
        "orion-nebula": 22,
        "eagle-nebula": 24,
        "crab-nebula": 24,
        "carina-nebula": 26,
        "lagoon-nebula": 22,
        "ring-nebula": 20,
        "helix-nebula": 20,
        "orion-arm": 60,
      },
    }
  }

  /* ------------------------------------------------------------------ */
  /* Observable universe                                                 */
  /* ------------------------------------------------------------------ */

  buildUniverse(): BuiltRegime {
    const group = new THREE.Group()
    group.name = "universe"
    const bodies = new Map<string, THREE.Object3D>()
    const labels: LabelSpec[] = []
    const random = seededRandom(13800)

    const cmb = new THREE.Mesh(
      new THREE.SphereGeometry(300, 64, 64),
      new THREE.MeshBasicMaterial({
        map: cmbTexture(),
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    group.add(cmb)
    const horizonGrid = createHairline(circlePoints(298, 256, "xz"), "#f59e0b", 0.12, true)
    horizonGrid.userData.layer = "grid"
    group.add(horizonGrid)

    const web: StarPoint[] = []
    const filaments = 18
    for (let f = 0; f < filaments; f++) {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      )
      const length = 30 + random() * 110
      const center = dir.clone().multiplyScalar(20 + random() * 80)
      const tangent = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0.001)).normalize()
      const tangent2 = new THREE.Vector3().crossVectors(dir, tangent).normalize()
      for (let i = 0; i < 620; i++) {
        const t = (random() - 0.5) * length
        const spread = 0.8 + random() * 4.2
        const p = center
          .clone()
          .add(tangent.clone().multiplyScalar(t))
          .add(tangent2.clone().multiplyScalar(gaussian(random) * spread))
          .add(dir.clone().multiplyScalar(gaussian(random) * spread * 0.6))
        const warm = random() < 0.08
        const color = new THREE.Color(warm ? "#e0a060" : random() < 0.3 ? "#8fb4d8" : "#d8e6f4")
        web.push({
          x: p.x,
          y: p.y,
          z: p.z,
          r: color.r,
          g: color.g,
          b: color.b,
          size: 0.5 + random() * 1.1,
        })
      }
    }
    for (let i = 0; i < 5200; i++) {
      const r = Math.pow(random(), 0.5) * 135
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      const color = new THREE.Color(random() < 0.15 ? "#e0a060" : "#a8c0d8")
      web.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi),
        z: r * Math.sin(phi) * Math.sin(theta),
        r: color.r,
        g: color.g,
        b: color.b,
        size: 0.4 + random() * 0.8,
      })
    }
    group.add(createStarPoints(web, { scale: 120, opacity: 0.5, minSize: 0.5, maxSize: 2.6 }))

    const localGroup = new THREE.Group()
    for (let i = 0; i < 90; i++) {
      const p = new THREE.Vector3(gaussian(random) * 5, gaussian(random) * 2.5, gaussian(random) * 5)
      const dot = createGlow(random() < 0.2 ? "#e0a060" : "#c8d8e8", 0.7 + random() * 0.8, 0.7)
      dot.position.copy(p)
      localGroup.add(dot)
    }
    localGroup.userData.bodyId = "local-group"
    group.add(localGroup)
    bodies.set("local-group", localGroup)
    labels.push({
      id: "local-group",
      name: "Local Group",
      bodyId: "local-group",
      kind: "region",
      sub: "YOU ARE HERE",
      priority: 10,
      getPosition: () => localGroup.getWorldPosition(new THREE.Vector3()),
    })

    const universeBodies = BODIES.filter((b) => b.regime === "universe")
    for (const body of universeBodies) {
      if (body.id === "local-group") continue
      let position: THREE.Vector3
      if (body.id === "laniakea") {
        position = new THREE.Vector3(-34, 18, -64)
      } else if (body.id === "cosmic-web") {
        position = new THREE.Vector3(42, 22, 48)
      } else if (body.id === "cmb-horizon") {
        position = new THREE.Vector3(0, 0, -286)
      } else if (body.raDeg !== undefined && body.decDeg !== undefined && body.distLy) {
        const dirVec = raDecToVector(body.raDeg, body.decDeg)
        position = new THREE.Vector3(dirVec.x, dirVec.y, dirVec.z).multiplyScalar(
          logDistance(body.distLy, UNIVERSE_MIN_LY),
        )
      } else {
        position = new THREE.Vector3(18, 8, 28)
      }
      const marker = new THREE.Group()
      marker.position.copy(position)
      marker.userData.bodyId = body.id
      marker.userData.focusDistance = body.kind === "cluster" || body.kind === "region" ? 60 : 32
      if (body.kind === "galaxy") {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: galaxyTexture(1024, body.id.length * 11),
            color: new THREE.Color(body.color),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        )
        const size = body.notable ? 15 : 10
        sprite.scale.set(size, size, 1)
        marker.add(sprite)
      } else if (body.kind === "cluster") {
        const sprite = createGlow(body.color, 15, 0.35)
        marker.add(sprite)
        for (let i = 0; i < 24; i++) {
          const dot = createGlow("#d8e6f4", 0.5 + random() * 0.6, 0.65)
          dot.position.set(gaussian(random) * 5, gaussian(random) * 4, gaussian(random) * 5)
          marker.add(dot)
        }
      } else if (body.kind === "horizon") {
        marker.add(createMarker("#f59e0b", 7, 0.8))
        marker.add(createGlow("#e0a060", 18, 0.2))
      } else {
        marker.add(createMarker(body.color, 3.4, 0.9))
        marker.add(createGlow(body.color, 8, 0.16))
      }
      group.add(marker)
      bodies.set(body.id, marker)
      labels.push({
        id: body.id,
        name: body.name,
        bodyId: body.id,
        kind: body.kind,
        priority: body.notable ? 8 : 4,
        maxCameraDistance: 700,
        getPosition: () => marker.getWorldPosition(new THREE.Vector3()),
        getSub: () => (body.distLy ? formatDistanceKm(body.distLy * 9.4607e12) : undefined),
      })
    }

    return {
      group,
      bodies,
      labels,
      focusDistance: {
        andromeda: 38,
        triangulum: 34,
        lmc: 26,
        smc: 26,
        "virgo-cluster": 58,
        "coma-cluster": 58,
        laniakea: 80,
        "great-attractor": 58,
        "local-group": 40,
        "cosmic-web": 80,
        "cmb-horizon": 100,
      },
    }
  }

  /* ------------------------------------------------------------------ */
  /* Shared sky                                                          */
  /* ------------------------------------------------------------------ */

  private buildSky(radius: number, scale: number, opacity: number, maxSize: number): THREE.Points {
    if (this.stars.length) {
      const points: StarPoint[] = []
      for (const star of this.stars) {
        if (!Number.isFinite(star.raDeg) || !Number.isFinite(star.decDeg)) continue
        if (star.mag > 8.2) continue
        const dir = raDecToVector(star.raDeg, star.decDeg)
        const [r, g, b] = bvToRgb(star.bv)
        points.push({
          x: dir.x * radius,
          y: dir.y * radius,
          z: dir.z * radius,
          r,
          g,
          b,
          size: Math.max(0.5, 2.5 - star.mag * 0.24),
        })
      }
      return createStarPoints(points, { scale, opacity, minSize: 0.8, maxSize })
    }
    const random = seededRandom(42)
    const points: StarPoint[] = []
    for (let i = 0; i < 2400; i++) {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      const [r, g, b] = bvToRgb(-0.3 + random() * 1.8)
      points.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
        r,
        g,
        b,
        size: 0.5 + random() * 1.8,
      })
    }
    return createStarPoints(points, { scale, opacity, minSize: 0.8, maxSize })
  }

  getSurfaceSource(): "gibs" | "fallback" | "none" {
    return this.surfaceSource
  }
}

export function bodyDistanceKm(body: Body, date: Date): number | null {
  if (body.id === "iss") return 420
  if (body.planetId) {
    const earth = planetPositionAu("earth", date)
    const pos = planetPositionAu(body.planetId, date)
    return Math.hypot(pos.x - earth.x, pos.y - earth.y, pos.z - earth.z) * AU_KM
  }
  if (body.distance) {
    switch (body.distance.unit) {
      case "km":
        return body.distance.value
      case "au":
        return body.distance.value * AU_KM
      case "ly":
        return body.distance.value * 9.4607e12
      case "mly":
        return body.distance.value * 9.4607e18
      case "gly":
        return body.distance.value * 9.4607e21
    }
  }
  return null
}

/** Used by the HUD to describe the galactic position of a catalog object. */
export function galacticLonLat(body: Body): { l: number; b: number } | null {
  if (body.raDeg === undefined || body.decDeg === undefined) return null
  return equatorialToGalactic(body.raDeg, body.decDeg)
}

export { eclipticToScene }
