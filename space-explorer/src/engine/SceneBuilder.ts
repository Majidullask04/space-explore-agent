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
  moonDistanceKm,
  moonGeoAu,
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
  cropTextureRegion,
  galaxyTexture,
  ringAlphaTexture,
  surfaceRegion,
  texture,
  type SurfaceRegion,
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
  updateStarPoints,
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

const MILKY_WAY_SCALE = 1 / 500
const UNIVERSE_MIN_LY = 1e6

function visualPlanetRadius(id: string): number {
  const km = PLANET_ELEMENTS[id]?.radiusKm ?? 6378
  return 2.0 + Math.log10(km / 1000) * 1.8
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

const SURFACE_PLATE_UNITS = 1300
const METERS_PER_DEG_LON = 111_320

/** Real ground extent of the fixed regional mosaic, used for honest readouts. */
function surfacePlate(region: SurfaceRegion): { widthM: number; widthUnits: number; heightUnits: number } {
  const centerLat = (region.latMin + region.latMax) / 2
  const widthM =
    (region.lonMax - region.lonMin) *
    METERS_PER_DEG_LON *
    Math.max(0.02, Math.cos(THREE.MathUtils.degToRad(centerLat)))
  return { widthM, widthUnits: SURFACE_PLATE_UNITS, heightUnits: SURFACE_PLATE_UNITS }
}

export class SceneBuilder {
  private stars: StarRecord[]
  private interstellarClouds: { local: THREE.Points; distant: THREE.Points } | null = null
  private earth = loadEarthTextures()
  private surfaceSource: "gibs" | "fallback" | "none" = "none"
  private surfacePlate: { widthM: number; widthUnits: number; heightUnits: number } | null = null
  onSurfaceSource?: (source: "gibs" | "fallback") => void

  constructor(stars: StarRecord[]) {
    this.stars = stars
  }

  setStars(stars: StarRecord[]) {
    this.stars = stars
    if (this.interstellarClouds) {
      updateStarPoints(this.interstellarClouds.local, this.localStarPoints())
      updateStarPoints(this.interstellarClouds.distant, this.distantStarPoints())
    }
  }

  private localStarPoints(): StarPoint[] {
    const points: StarPoint[] = []
    for (const star of this.stars) {
      if (!Number.isFinite(star.raDeg) || !Number.isFinite(star.decDeg)) continue
      if (star.distPc <= 0 || star.distPc >= 400 || star.mag >= 10.5) continue
      const dir = raDecToVector(star.raDeg, star.decDeg)
      const [r, g, b] = bvToRgb(star.bv)
      const d = star.distPc * 3.26156
      points.push({
        x: dir.x * d,
        y: dir.y * d,
        z: dir.z * d,
        r,
        g,
        b,
        size: Math.max(0.5, 3.4 - star.mag * 0.29),
      })
    }
    return points
  }

  private distantStarPoints(): StarPoint[] {
    const points: StarPoint[] = []
    for (const star of this.stars) {
      if (!Number.isFinite(star.raDeg) || !Number.isFinite(star.decDeg)) continue
      if (star.mag >= 8.2) continue
      if (star.distPc > 0 && star.distPc < 400 && star.mag < 10.5) continue
      const dir = raDecToVector(star.raDeg, star.decDeg)
      const [r, g, b] = bvToRgb(star.bv)
      points.push({
        x: dir.x * 2200,
        y: dir.y * 2200,
        z: dir.z * 2200,
        r,
        g,
        b,
        size: Math.max(0.5, 2.4 - star.mag * 0.2),
      })
    }
    return points
  }

  /* ------------------------------------------------------------------ */
  /* Surface                                                             */
  /* ------------------------------------------------------------------ */

  buildSurface(origin: Origin): BuiltRegime {
    const group = new THREE.Group()
    group.name = "surface"
    const bodies = new Map<string, THREE.Object3D>()
    const region = surfaceRegion(origin.lat, origin.lng)
    this.surfacePlate = surfacePlate(region)
    const width = SURFACE_PLATE_UNITS
    const height = SURFACE_PLATE_UNITS
    const fallback = cropTextureRegion(texture("/textures/earth_day.jpg"), region)
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

    const markerX = ((origin.lng - (region.lonMin + region.lonMax) / 2) / (region.lonMax - region.lonMin)) * width
    const markerY = ((origin.lat - (region.latMin + region.latMax) / 2) / (region.latMax - region.latMin)) * height
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

    void this.refreshSurface(plane, region)
    return built
  }

  getSurfacePlate() {
    return this.surfacePlate
  }

  private async refreshSurface(plane: THREE.Mesh, region: SurfaceRegion) {
    try {
      const mosaic = await buildGibsMosaic(region)
      const material = plane.material as THREE.MeshBasicMaterial
      const previous = material.map
      material.map = mosaic.texture
      material.needsUpdate = true
      if (previous?.userData?.owned) previous.dispose()
      this.surfaceSource = mosaic.source
      this.onSurfaceSource?.(mosaic.source)
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
      nightIntensity: 0.55,
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

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.16, 48, 48),
      new THREE.MeshStandardMaterial({ map: texture("/textures/moon.jpg"), roughness: 1 }),
    )
    moonMesh.userData.bodyId = "moon"
    moonMesh.userData.focusDistance = 26
    group.add(moonMesh)
    bodies.set("moon", moonMesh)

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
    const moonLabel: LabelSpec = {
      id: "moon",
      name: "Moon",
      bodyId: "moon",
      kind: "moon",
      priority: 6,
      getPosition: () => moonMesh.getWorldPosition(new THREE.Vector3()),
      getSub: (ctx) => {
        const km = moonDistanceKm(ctx.date)
        return `${Math.round(km).toLocaleString("en-US")} km`
      },
    }
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

    // Smoothed orbital state so the ISS glides between live API samples
    // instead of teleporting every refresh.
    let issLat = 23.18
    let issLng = 78.94
    let issSeeded = false

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
        if (!issSeeded) {
          issLat = ctx.iss.lat
          issLng = ctx.iss.lng
          issSeeded = true
        }
        const k = 1 - Math.exp(-Math.max(ctx.dt, 0) * 0.55)
        const shortLng = (((ctx.iss.lng - issLng + 540) % 360) + 360) % 360 - 180
        issLng += shortLng * k
        issLat += (ctx.iss.lat - issLat) * k
        const alt = radius * (1 + ctx.iss.altitudeKm / 6378.137)
        issMarker.position.copy(geoToSphere(issLat, issLng, alt))
        issOrbit.rotation.x = THREE.MathUtils.degToRad(51.6)
      } else {
        issMarker.position.copy(geoToSphere(23.18, 78.94, radius * 1.066))
      }
      originMarker.position.copy(geoToSphere(ctx.origin.lat, ctx.origin.lng, radius * 1.008))
      originMarker.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        originMarker.position.clone().normalize(),
      )
      const moonAu = moonGeoAu(ctx.date)
      const moonDir = new THREE.Vector3(moonAu.x, moonAu.z, -moonAu.y)
      if (moonDir.lengthSq() > 1e-12) moonDir.normalize()
      moonMesh.position.copy(moonDir).multiplyScalar(radius * 2.9)
      moonMesh.rotation.y = ctx.date.getTime() / 86400000 / 27.3217 * Math.PI * 2
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
      labels: [earthLabel, moonLabel, originLabel, issLabel],
      update,
      focusDistance: { earth: 330, moon: 40, iss: 34, origin: 330 },
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

    // DirectionalLight: parallel sunlight from the Sun, intensity is a plain
    // multiplier (no inverse-square falloff), appropriate for solar-system scale.
    const sunLight = new THREE.DirectionalLight("#fff2dd", 4.0)
    sunLight.position.set(0, 0, 0)
    sunLight.target.position.set(1, 0, 0)
    sunLight.target.updateMatrixWorld()
    sunLight.castShadow = false
    group.add(sunLight.target)
    group.add(sunLight)

    group.add(new THREE.AmbientLight("#0b1624", 0.25))

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
            #include <common>
            #include <logdepthbuf_pars_vertex>
            void main() {
              vPos = position.xy;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              #include <logdepthbuf_vertex>
            }
          `,
          fragmentShader: /* glsl */ `
            uniform sampler2D ringMap;
            uniform float inner;
            uniform float outer;
            uniform float opacity;
            varying vec2 vPos;
            #include <logdepthbuf_pars_fragment>
            void main() {
              #include <logdepthbuf_fragment>
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
        id === "earth" ? 0.12 : 0.065,
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
          if (id === "earth") return "1.00 AU from the Sun"
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
      maxCameraDistance: 150,
      getPosition: () => moon.getWorldPosition(new THREE.Vector3()),
      getSub: (ctx) => {
        const km = moonDistanceKm(ctx.date)
        return `${Math.round(km).toLocaleString("en-US")} km · ${(km / 299792.458).toFixed(1)} s`
      },
    })

    // Active spacecraft on their real heliocentric distances. Positions are
    // fixed trajectory bearings (ecliptic longitude/latitude) at the current
    // epoch; radial distance is faithful to the catalog.
    const SPACECRAFT: Array<{ id: string; au: number; lonDeg: number; latDeg: number }> = [
      { id: "parker-solar-probe", au: 0.1, lonDeg: 118, latDeg: 3 },
      { id: "jwst", au: 1.01, lonDeg: 96, latDeg: -1 },
      { id: "new-horizons", au: 61, lonDeg: 289, latDeg: 2 },
      { id: "voyager-2", au: 139, lonDeg: 289, latDeg: -34 },
      { id: "voyager-1", au: 167, lonDeg: 255, latDeg: 35 },
    ]
    for (const craft of SPACECRAFT) {
      const body = findBody(craft.id)
      const lon = THREE.MathUtils.degToRad(craft.lonDeg)
      const lat = THREE.MathUtils.degToRad(craft.latDeg)
      const au = { x: Math.cos(lat) * Math.cos(lon) * craft.au, y: Math.cos(lat) * Math.sin(lon) * craft.au, z: Math.sin(lat) * craft.au }
      const probe = new THREE.Group()
      probe.position.copy(compressedAu(au))
      probe.userData.bodyId = craft.id
      probe.userData.layer = "spacecraft"
      probe.userData.focusDistance = 26
      probe.add(createMarker("#f59e0b", 1.9, 0.95))
      probe.add(createGlow("#f59e0b", 3.4, 0.5, true))
      group.add(probe)
      bodies.set(craft.id, probe)
      labels.push({
        id: craft.id,
        name: body?.name ?? craft.id,
        bodyId: craft.id,
        kind: "spacecraft",
        priority: craft.id === "jwst" ? 3 : body?.notable ? 7 : 4,
        maxCameraDistance: craft.id === "jwst" ? 160 : 1200,
        getPosition: () => probe.getWorldPosition(new THREE.Vector3()),
        getSub: () => `${craft.au < 1 ? craft.au.toFixed(2) : Math.round(craft.au)} AU`,
      })
    }

    const jupiter = planetGroups.get("jupiter")!
    const jupiterMoons: Array<{ id: string; color: string; distance: number; size: number; period: number }> = [
      { id: "io", color: "#d8c17a", distance: 5.3, size: 1.3, period: 1.77 },
      { id: "europa", color: "#d8d2c0", distance: 6.5, size: 1.15, period: 3.55 },
      { id: "ganymede", color: "#a89e90", distance: 7.9, size: 1.45, period: 7.15 },
      { id: "callisto", color: "#8c8478", distance: 9.6, size: 1.25, period: 16.69 },
    ]

    // One InstancedMesh for the Galilean moons: shared geometry + material,
    // per-instance matrix (position/scale) and per-instance color.
    const moonGeo = new THREE.SphereGeometry(1, 24, 24)
    const moonMat = new THREE.MeshStandardMaterial({ roughness: 1 })
    const jupiterMoonsMesh = new THREE.InstancedMesh(moonGeo, moonMat, jupiterMoons.length)
    const dummy = new THREE.Object3D()
    // Reusable temporaries (avoid per-frame allocations in the label getPosition path)
    const tmpMatrix = new THREE.Matrix4()
    const tmpQuat = new THREE.Quaternion()
    const tmpScale = new THREE.Vector3()
    // Cached world positions for label projection, refreshed each frame in update()
    const moonWorldPos: THREE.Vector3[] = jupiterMoons.map(() => new THREE.Vector3())

    for (let i = 0; i < jupiterMoons.length; i++) {
      const m = jupiterMoons[i]
      dummy.position.set(m.distance, 0, 0)
      dummy.scale.setScalar(m.size * 0.55)
      dummy.updateMatrix()
      jupiterMoonsMesh.setMatrixAt(i, dummy.matrix)
      jupiterMoonsMesh.setColorAt(i, new THREE.Color(m.color))
      const meshProxy = new THREE.Mesh(moonGeo, moonMat)
      meshProxy.userData.bodyId = m.id
      bodies.set(m.id, meshProxy)
      labels.push({
        id: m.id,
        name: findBody(m.id)?.name ?? m.id,
        bodyId: m.id,
        kind: "moon",
        priority: 2,
        maxCameraDistance: 90,
        getPosition: () => moonWorldPos[i],
      })
    }
    jupiterMoonsMesh.instanceMatrix.needsUpdate = true
    const instanceColor = jupiterMoonsMesh.instanceColor
    if (instanceColor) instanceColor.needsUpdate = true
    jupiterMoonsMesh.userData.bodyId = "jupiter-moons"
    jupiterMoonsMesh.userData.layer = "orbits"
    jupiter.add(jupiterMoonsMesh)

    // Per-moon orbital state for the update loop
    const jupiterMoonState: Array<{ id: string; distance: number; period: number; index: number }> = jupiterMoons.map((m, i) => ({
      id: m.id, distance: m.distance, period: m.period, index: i,
    }))

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
      // Real geocentric lunar position, mapped into the compressed scene.
      const moonAu = moonGeoAu(date)
      const moonDir = new THREE.Vector3(moonAu.x, moonAu.z, -moonAu.y)
      if (moonDir.lengthSq() > 1e-12) moonDir.normalize()
      moon.position.copy(moonDir).multiplyScalar(6.2)
      moon.rotation.y = (days / 27.3217) * Math.PI * 2
      // Animate the Galilean moon InstancedMesh: per-instance orbital position.
      // Reuse one dummy across instances to avoid allocations.
      for (const m of jupiterMoonState) {
        const angle = (days / m.period) * Math.PI * 2
        dummy.position.set(m.distance * Math.cos(angle), 0, m.distance * Math.sin(angle))
        dummy.scale.setScalar(jupiterMoons[m.index].size * 0.55)
        dummy.updateMatrix()
        jupiterMoonsMesh.setMatrixAt(m.index, dummy.matrix)
        // Cache world position for label projection: instance local -> jupiter world space
        jupiterMoonsMesh.getMatrixAt(m.index, tmpMatrix)
        tmpMatrix.decompose(moonWorldPos[m.index], tmpQuat, tmpScale)
        moonWorldPos[m.index].applyMatrix4(jupiter.matrixWorld)
      }
      jupiterMoonsMesh.instanceMatrix.needsUpdate = true
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

    const localCloud = createStarPoints(this.localStarPoints(), {
      scale: 220,
      opacity: 1,
      minSize: 1.4,
      maxSize: 11,
    })
    const distantCloud = createStarPoints(this.distantStarPoints(), {
      scale: 9000,
      opacity: 0.6,
      minSize: 1,
      maxSize: 6,
    })
    group.add(localCloud, distantCloud)
    this.interstellarClouds = { local: localCloud, distant: distantCloud }

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
      if (body.kind === "star") marker.add(createGlow(body.color, size * 3.2, 0.42))
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

    // 1. Central Bulge and Bar (16,000 particles)
    const bulgePoints: StarPoint[] = []
    const barAngle = THREE.MathUtils.degToRad(27)
    const cosBar = Math.cos(barAngle)
    const sinBar = Math.sin(barAngle)
    const bulgeColors = [new THREE.Color("#ffe5b4"), new THREE.Color("#ffcf70"), new THREE.Color("#ffa834"), new THREE.Color("#fff3e0")]

    for (let i = 0; i < 16000; i++) {
      const u = random()
      const r = -Math.log(1 - u * 0.98) * 3.8
      if (r > 20) continue

      const alongBar = (random() - 0.5) * r * 1.8
      const perpBar = gaussian(random) * (0.8 + r * 0.12)
      const x = alongBar * cosBar - perpBar * sinBar
      const z = alongBar * sinBar + perpBar * cosBar
      const y = gaussian(random) * (1.8 * Math.exp(-r / 7) + 0.3)

      const col = bulgeColors[Math.floor(random() * bulgeColors.length)]
      bulgePoints.push({
        x,
        y,
        z,
        r: col.r,
        g: col.g,
        b: col.b,
        size: 0.6 + random() * 1.4,
      })
    }
    const bulgeMesh = createStarPoints(bulgePoints, { scale: 120, opacity: 0.95, minSize: 0.8, maxSize: 5.5, soft: true })
    group.add(bulgeMesh)
    group.add(createGlow("#ffd9a0", 28, 0.75))
    group.add(createGlow("#ffaa44", 14, 0.65, true))

    // 2. 4 Logarithmic Spiral Arms (54,000 particles)
    const armPoints: StarPoint[] = []
    const armColors = [
      new THREE.Color("#b5d5ff"), // hot blue-white
      new THREE.Color("#e6f0ff"), // pure white
      new THREE.Color("#fff2d8"), // golden disk star
      new THREE.Color("#88b4ff"), // bright blue knot
      new THREE.Color("#ff8aa8"), // pink HII knot
    ]

    for (let i = 0; i < 54000; i++) {
      const armIndex = i % 4
      const baseAngle = (armIndex / 4) * Math.PI * 2
      const r = 5.5 + Math.pow(random(), 0.72) * 58
      const theta = baseAngle + Math.log(r / 5.5) / 0.23
      const spread = (0.7 + (r / 60) * 4.2) * gaussian(random)
      const angle = theta + spread / r
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const y = gaussian(random) * (0.35 + (r / 60) * 0.9)

      const isOB = random() < 0.28
      const isHII = random() < 0.08
      let col: THREE.Color
      if (isHII) col = armColors[4]
      else if (isOB) col = armColors[random() < 0.5 ? 0 : 3]
      else col = armColors[random() < 0.5 ? 1 : 2]

      armPoints.push({
        x,
        y,
        z,
        r: col.r,
        g: col.g,
        b: col.b,
        size: 0.5 + random() * (isOB ? 1.6 : 0.9),
      })
    }
    const armsMesh = createStarPoints(armPoints, { scale: 130, opacity: 0.9, minSize: 0.9, maxSize: 5.2, soft: true })
    group.add(armsMesh)

    // 2b. Diffuse stellar disk: fills the inter-arm space with a faint warm
    // haze so the spiral reads as a galaxy, not as separate dotted curves.
    const diskPoints: StarPoint[] = []
    const diskWarm = new THREE.Color("#f3e3c6")
    const diskCool = new THREE.Color("#cdddfb")
    for (let i = 0; i < 16000; i++) {
      const r = 3.5 + Math.pow(random(), 0.55) * 60
      const angle = random() * Math.PI * 2
      const y = gaussian(random) * (0.45 + (r / 60) * 1.4)
      const col = random() < 0.6 ? diskWarm : diskCool
      diskPoints.push({
        x: Math.cos(angle) * r,
        y,
        z: Math.sin(angle) * r,
        r: col.r,
        g: col.g,
        b: col.b,
        size: 0.8 + random() * 2.1,
      })
    }
    group.add(
      createStarPoints(diskPoints, {
        scale: 150,
        opacity: 0.3,
        minSize: 1,
        maxSize: 5,
        soft: true,
      }),
    )

    // 3. Dark Dust Lanes (10,000 absorbing particles)
    const dustPoints: StarPoint[] = []
    const dustColors = [new THREE.Color("#180f08"), new THREE.Color("#24160c"), new THREE.Color("#0f0703")]
    for (let i = 0; i < 10000; i++) {
      const armIndex = i % 4
      const baseAngle = (armIndex / 4) * Math.PI * 2 - 0.18 // inner edge
      const r = 7.0 + Math.pow(random(), 0.68) * 52
      const theta = baseAngle + Math.log(r / 5.5) / 0.23
      const spread = (0.5 + (r / 60) * 2.5) * gaussian(random)
      const angle = theta + spread / r
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const y = gaussian(random) * (0.25 + (r / 60) * 0.6)

      const col = dustColors[Math.floor(random() * dustColors.length)]
      dustPoints.push({
        x,
        y,
        z,
        r: col.r,
        g: col.g,
        b: col.b,
        size: 1.2 + random() * 2.2,
      })
    }
    const dustMesh = createStarPoints(dustPoints, {
      scale: 110,
      opacity: 0.5,
      minSize: 1.0,
      maxSize: 6.0,
      soft: true,
      blending: THREE.NormalBlending,
    })
    group.add(dustMesh)

    // 4. Sagittarius A* (Supermassive Black Hole with Accretion Glow - NO cartoon flat black dot!)
    const sgr = new THREE.Group()
    sgr.add(createGlow("#ffb74d", 6.0, 0.95))
    sgr.add(createMarker("#f59e0b", 3.8, 0.9))
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

    // 5. Sun in the Orion Arm
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
      0.08,
      true,
    )
    sunOrbitRing.userData.layer = "grid"
    group.add(sunOrbitRing)

    // 6. Volumetric 3D Nebulae & Deep-Sky Objects (NO square image planes!)
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
        // Soft volumetric 3D particle cloud - purely procedural soft particles
        const nebPoints: StarPoint[] = []
        const nebCount = 420
        const randNeb = seededRandom(body.id.length * 97 + 13)
        const primaryCol = new THREE.Color(body.color || "#e070ff")
        const secondaryCol = body.id === "orion-nebula"
          ? new THREE.Color("#38d9c0")
          : body.id === "carina-nebula"
          ? new THREE.Color("#ffa033")
          : body.id === "crab-nebula"
          ? new THREE.Color("#ff7700")
          : new THREE.Color("#4dd2ff")

        const cloudRadius = body.notable ? 4.8 : 3.4
        for (let j = 0; j < nebCount; j++) {
          const np = new THREE.Vector3(
            gaussian(randNeb) * cloudRadius * 0.45,
            gaussian(randNeb) * cloudRadius * 0.35,
            gaussian(randNeb) * cloudRadius * 0.45,
          )
          const useSec = randNeb() < 0.42
          const c = useSec ? secondaryCol : primaryCol
          nebPoints.push({
            x: np.x,
            y: np.y,
            z: np.z,
            r: c.r * (0.8 + randNeb() * 0.4),
            g: c.g * (0.8 + randNeb() * 0.4),
            b: c.b * (0.8 + randNeb() * 0.4),
            size: 1.2 + randNeb() * 2.8,
          })
        }
        const nebCloud = createStarPoints(nebPoints, {
          scale: 85,
          opacity: 0.75,
          minSize: 1.5,
          maxSize: 8.0,
          soft: true,
        })
        marker.add(nebCloud)
        marker.add(createMarker(body.color, 2.2, 0.8))
        marker.add(createGlow(body.color, 5.0, 0.3))
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

    // 1. Planck CMB horizon: a delicate particulate shell plus three faint
    // great circles. No photographic sphere, so there is never a blurry
    // mottled ball at the outer boundary.
    const horizonPoints: StarPoint[] = []
    const horizonCool = new THREE.Color("#7fb4ff")
    const horizonWarm = new THREE.Color("#ffb877")
    for (let i = 0; i < 9000; i++) {
      const theta = random() * Math.PI * 2
      const z = random() * 2 - 1
      const r = Math.sqrt(Math.max(0, 1 - z * z))
      const radius = 556 + random() * 4
      const c = horizonCool.clone().lerp(horizonWarm, random() * 0.55)
      horizonPoints.push({
        x: Math.cos(theta) * r * radius,
        y: z * radius,
        z: Math.sin(theta) * r * radius,
        r: c.r,
        g: c.g,
        b: c.b,
        size: 0.35 + random() * 0.9,
      })
    }
    const horizonShell = createStarPoints(horizonPoints, {
      scale: 260,
      opacity: 0.26,
      minSize: 0.5,
      maxSize: 2.2,
      soft: true,
    })
    group.add(horizonShell)

    const horizonGrid = createHairline(circlePoints(558, 256, "xz"), "#9db8d8", 0.05, true)
    horizonGrid.userData.layer = "grid"
    group.add(horizonGrid)

    // 2. Genuine 3D Cosmic Web: Filamentary Galaxy Superclusters
    const NODES = [
      { name: "Local Group", pos: new THREE.Vector3(0, 0, 0), color: "#ffffff", size: 1.2 },
      { name: "Virgo Supercluster", pos: new THREE.Vector3(0, 24, 6), color: "#c8e2ff", size: 1.5 },
      { name: "Laniakea / Great Attractor", pos: new THREE.Vector3(-44, 20, -64), color: "#ffd28e", size: 2.2 },
      { name: "Perseus-Pisces", pos: new THREE.Vector3(56, -22, 44), color: "#a8d4ff", size: 1.8 },
      { name: "Coma Cluster", pos: new THREE.Vector3(12, 62, -24), color: "#e2d0ff", size: 1.6 },
      { name: "Shapley Supercluster", pos: new THREE.Vector3(-84, 30, -92), color: "#ffd59e", size: 2.4 },
      { name: "Hercules Supercluster", pos: new THREE.Vector3(48, 48, -28), color: "#c0e8ff", size: 1.5 },
      { name: "Centaurus Supercluster", pos: new THREE.Vector3(-32, 12, -46), color: "#ffdfb0", size: 1.6 },
      { name: "Pavo-Indus", pos: new THREE.Vector3(-40, -42, -18), color: "#b8dcff", size: 1.4 },
      { name: "Horologium-Reticulum", pos: new THREE.Vector3(-65, -55, 30), color: "#dcd0ff", size: 1.7 },
      { name: "Sculptor Supercluster", pos: new THREE.Vector3(35, -50, -25), color: "#b5d8ff", size: 1.5 },
    ]

    const filamentEdges: Array<[THREE.Vector3, THREE.Vector3]> = [
      [NODES[0].pos, NODES[1].pos],
      [NODES[1].pos, NODES[7].pos],
      [NODES[7].pos, NODES[2].pos],
      [NODES[2].pos, NODES[5].pos],
      [NODES[1].pos, NODES[4].pos],
      [NODES[4].pos, NODES[6].pos],
      [NODES[0].pos, NODES[3].pos],
      [NODES[3].pos, NODES[6].pos],
      [NODES[0].pos, NODES[8].pos],
      [NODES[8].pos, NODES[2].pos],
      [NODES[8].pos, NODES[9].pos],
      [NODES[0].pos, NODES[10].pos],
      [NODES[10].pos, NODES[3].pos],
    ]

    for (const [p1, p2] of filamentEdges) {
      const mid = p1.clone().add(p2).multiplyScalar(0.5)
      const bend = new THREE.Vector3(
        gaussian(random) * 4.5,
        gaussian(random) * 4.5,
        gaussian(random) * 4.5,
      )
      mid.add(bend)
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
      const spinePoints = curve.getPoints(24)
      const spineLine = createHairline(spinePoints, "#7dd3fc", 0.045)
      group.add(spineLine)
    }

    const webPoints: StarPoint[] = []
    const galaxyHues = [
      new THREE.Color("#d0e4f7"),
      new THREE.Color("#ffdfa0"),
      new THREE.Color("#e8dcf8"),
      new THREE.Color("#ffffff"),
    ]

    // Dense cluster cores at each supercluster node.
    for (const node of NODES) {
      const baseColor = new THREE.Color(node.color)
      for (let i = 0; i < 650; i++) {
        webPoints.push({
          x: node.pos.x + gaussian(random) * 7,
          y: node.pos.y + gaussian(random) * 6,
          z: node.pos.z + gaussian(random) * 7,
          r: baseColor.r,
          g: baseColor.g,
          b: baseColor.b,
          size: 0.5 + random() * 1.2,
        })
      }
    }

    for (let i = 0; i < 42000; i++) {
      let p: THREE.Vector3
      let col: THREE.Color
      let size: number

      if (random() < 0.72) {
        const edge = filamentEdges[Math.floor(random() * filamentEdges.length)]
        const t = random()
        const base = edge[0].clone().lerp(edge[1], t)
        const transverse = (2.0 + Math.sin(t * Math.PI) * 4.2) * gaussian(random)
        const perp = new THREE.Vector3(gaussian(random), gaussian(random), gaussian(random)).normalize().multiplyScalar(transverse)
        p = base.add(perp)
        col = galaxyHues[Math.floor(random() * (galaxyHues.length - 1))]
        size = 0.5 + random() * 1.1
      } else {
        const theta = random() * Math.PI * 2
        const phi = Math.acos(2 * random() - 1)
        const r = 25 + Math.pow(random(), 0.6) * 165
        p = new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        )
        const distBootes = p.distanceTo(new THREE.Vector3(25, 42, 25))
        if (distBootes < 24) continue

        col = galaxyHues[Math.floor(random() * galaxyHues.length)]
        size = 0.4 + random() * 0.9
      }

      webPoints.push({
        x: p.x,
        y: p.y,
        z: p.z,
        r: col.r,
        g: col.g,
        b: col.b,
        size,
      })
    }

    const webMesh = createStarPoints(webPoints, { scale: 125, opacity: 0.7, minSize: 0.7, maxSize: 3.8, soft: true })
    group.add(webMesh)

    // Local Group at the centre: the Milky Way itself plus its satellites.
    const localGroup = new THREE.Group()
    const milkyWayDisc = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: galaxyTexture(512, 21),
        color: new THREE.Color("#ffe4c2"),
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    milkyWayDisc.scale.set(17, 17, 1)
    localGroup.add(milkyWayDisc)
    for (let i = 0; i < 34; i++) {
      const p = new THREE.Vector3(gaussian(random) * 7, gaussian(random) * 3, gaussian(random) * 7)
      const dot = createGlow(random() < 0.25 ? "#ffd9a0" : "#c8e2ff", 0.7 + random() * 0.8, 0.65)
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

    // Universe catalog bodies
    const universeBodies = BODIES.filter((b) => b.regime === "universe")
    for (const body of universeBodies) {
      if (body.id === "local-group") continue
      let position: THREE.Vector3
      if (body.id === "laniakea") {
        position = new THREE.Vector3(-44, 20, -64)
      } else if (body.id === "cosmic-web") {
        position = new THREE.Vector3(42, 24, 46)
      } else if (body.id === "cmb-horizon") {
        position = new THREE.Vector3(0, 0, -556)
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
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        )
        const size = body.notable ? 14 : 9
        sprite.scale.set(size, size, 1)
        marker.add(sprite)
      } else if (body.kind === "cluster") {
        const sprite = createGlow(body.color, 16, 0.38)
        marker.add(sprite)
        for (let i = 0; i < 28; i++) {
          const dot = createGlow("#d8e6f4", 0.5 + random() * 0.7, 0.7)
          dot.position.set(gaussian(random) * 5.5, gaussian(random) * 4.2, gaussian(random) * 5.5)
          marker.add(dot)
        }
      } else if (body.kind === "horizon") {
        marker.add(createMarker("#f59e0b", 3.4, 0.6))
        marker.add(createGlow("#e0a060", 8, 0.14))
      } else {
        marker.add(createMarker(body.color, 3.2, 0.9))
        marker.add(createGlow(body.color, 7.5, 0.18))
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
        "cmb-horizon": 120,
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
