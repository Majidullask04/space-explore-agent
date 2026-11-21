import * as THREE from "three"
import { glowSpriteTexture, markerTexture } from "./textures"

export interface StarPoint {
  x: number
  y: number
  z: number
  r: number
  g: number
  b: number
  size: number
}

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uMinSize;
  uniform float uMaxSize;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uPixelRatio * (uScale / max(1.0, -mv.z));
    gl_PointSize = clamp(px, uMinSize, uMaxSize);
    gl_Position = projectionMatrix * mv;
  }
`

const STAR_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uSoft;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    if (d > 0.5) discard;
    float a;
    if (uSoft > 0.5) {
      a = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.4);
      gl_FragColor = vec4(vColor, a * uOpacity);
    } else {
      a = smoothstep(0.5, 0.04, d);
      a = pow(a, 1.55);
      vec3 col = vColor * (0.72 + a * 0.5);
      gl_FragColor = vec4(col, a * uOpacity);
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export interface StarFieldOptions {
  scale?: number
  opacity?: number
  minSize?: number
  maxSize?: number
  blending?: THREE.Blending
  soft?: boolean
}

export function createStarPoints(points: StarPoint[], options: StarFieldOptions = {}): THREE.Points {
  const geometry = new THREE.BufferGeometry()
  const position = new Float32Array(points.length * 3)
  const color = new Float32Array(points.length * 3)
  const size = new Float32Array(points.length)
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    position[i * 3] = p.x
    position[i * 3 + 1] = p.y
    position[i * 3 + 2] = p.z
    color[i * 3] = p.r
    color[i * 3 + 1] = p.g
    color[i * 3 + 2] = p.b
    size[i] = p.size
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3))
  geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3))
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uScale: { value: options.scale ?? 4000 },
      uOpacity: { value: options.opacity ?? 0.95 },
      uMinSize: { value: options.minSize ?? 1 },
      uMaxSize: { value: options.maxSize ?? 12 },
      uSoft: { value: options.soft ? 1.0 : 0.0 },
    },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: options.blending ?? THREE.AdditiveBlending,
    toneMapped: false,
  })

  const cloud = new THREE.Points(geometry, material)
  cloud.frustumCulled = false
  return cloud
}

export function setStarFieldOpacity(cloud: THREE.Points, opacity: number) {
  const material = cloud.material as THREE.ShaderMaterial
  if (material.uniforms?.uOpacity) material.uniforms.uOpacity.value = opacity
}

export function createGlow(color: string, size: number, opacity = 0.8, hard = false): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: glowSpriteTexture(color, hard),
    color: new THREE.Color("#ffffff"),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.setScalar(size)
  return sprite
}

export function createMarker(color: string, size: number, opacity = 1): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: markerTexture(color),
    color: new THREE.Color("#ffffff"),
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.setScalar(size)
  return sprite
}

export function createHairline(
  points: THREE.Vector3[],
  color: string,
  opacity = 0.4,
  closed = false,
): THREE.Line | THREE.LineLoop {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material)
}

export function circlePoints(radius: number, segments = 192, plane: "xz" | "xy" = "xz"): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    if (plane === "xz") points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    else points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
  }
  return points
}

/** Convert geographic coordinates into the sphere's texture-aligned local frame. */
export function geoToSphere(latDeg: number, lonDeg: number, radius = 1): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ).multiplyScalar(radius)
}

/** A small crosshair and ring used for the user's location. */
export function createOriginMarker(color = "#38bdf8", size = 3): THREE.Group {
  const group = new THREE.Group()
  const ring = createMarker(color, size, 1)
  group.add(ring)
  const dot = createGlow(color, size * 0.34, 0.9, true)
  group.add(dot)
  return group
}

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gaussian(random: () => number): number {
  const u = Math.max(1e-9, random())
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v)
}

/** Convert a heliocentric ecliptic AU position into the scene, compressed radially. */
export function compressedAu(p: { x: number; y: number; z: number }, base = 90, power = 0.42): THREE.Vector3 {
  const r = Math.hypot(p.x, p.y, p.z)
  if (r < 1e-9) return new THREE.Vector3()
  const sceneR = base * Math.pow(r, power)
  const k = sceneR / r
  return new THREE.Vector3(p.x * k, p.z * k, -p.y * k)
}

export function compressedAuScalar(rAu: number, base = 90, power = 0.42): number {
  return base * Math.pow(Math.max(0, rAu), power)
}

export function logDistance(distLy: number, min = 1e6, base = 30, span = 22): number {
  const mly = Math.max(0.01, distLy / min)
  return base + span * Math.log10(1 + mly)
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (!material) return
    const list = Array.isArray(material) ? material : [material]
    for (const item of list) {
      const withMap = item as THREE.Material & { map?: THREE.Texture | null }
      if (withMap.map && withMap.map.userData?.owned) withMap.map.dispose()
      item.dispose()
    }
  })
}

export function worldPositionOf(object: THREE.Object3D): THREE.Vector3 {
  return object.getWorldPosition(new THREE.Vector3())
}
