import * as THREE from "three"
import { texture } from "./textures"

export interface EarthTextures {
  day: THREE.Texture
  night: THREE.Texture
  clouds: THREE.Texture
  specular: THREE.Texture
  normal?: THREE.Texture
}

export function loadEarthTextures(): EarthTextures {
  return {
    day: texture("/textures/earth_day.jpg"),
    night: texture("/textures/earth_night.jpg"),
    clouds: texture("/textures/earth_clouds.jpg", false),
    specular: texture("/textures/earth_specular.jpg", false),
    normal: texture("/textures/earth_normal.jpg", false),
  }
}

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D cloudMap;
  uniform sampler2D specMap;
  uniform vec3 sunDirection;
  uniform float nightIntensity;
  uniform float exposure;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndl = dot(N, L);
    float day = smoothstep(-0.075, 0.12, ndl);

    vec3 dayCol = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;
    float cloud = texture2D(cloudMap, vUv + vec2(0.0032, 0.0016)).r;

    // Cloud shadows are subtle; the visible cloud shell sits above.
    dayCol *= mix(1.0, 0.82, smoothstep(0.0, 0.8, cloud));

    vec3 H = normalize(L + V);
    float specMask = texture2D(specMap, vUv).r;
    float spec = pow(max(dot(N, H), 0.0), 80.0) * specMask * smoothstep(0.0, 0.18, ndl);

    vec3 col = dayCol * (0.028 + 1.12 * max(ndl, 0.0));
    col += nightCol * vec3(1.15, 1.04, 0.86) * (1.0 - day) * nightIntensity;
    col += vec3(1.0, 0.93, 0.80) * spec * 0.55;

    // Airglow / Rayleigh limb seen at grazing angles on the lit side.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.1);
    float atmo = fres * smoothstep(-0.28, 0.5, ndl);
    col += vec3(0.08, 0.30, 0.72) * atmo * 0.65;

    // Warm the terminator just enough to read as atmosphere, not a filter.
    float twilight = smoothstep(0.12, -0.06, ndl) * smoothstep(-0.34, 0.02, ndl);
    col += vec3(0.10, 0.035, 0.008) * twilight;

    col *= exposure;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createEarthMaterial(
  textures: EarthTextures,
  sunDirection: THREE.Vector3,
  options: { nightIntensity?: number; exposure?: number } = {},
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: textures.day },
      nightMap: { value: textures.night },
      cloudMap: { value: textures.clouds },
      specMap: { value: textures.specular },
      sunDirection: { value: sunDirection.clone().normalize() },
      nightIntensity: { value: options.nightIntensity ?? 0.95 },
      exposure: { value: options.exposure ?? 1.0 },
    },
    vertexShader: EARTH_VERTEX,
    fragmentShader: EARTH_FRAGMENT,
    toneMapped: true,
  })
}

const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  uniform float opacity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float a = texture2D(cloudMap, vUv).g;
    a = smoothstep(0.05, 0.9, a) * opacity;
    vec3 N = normalize(vNormalW);
    vec3 L = normalize(sunDirection);
    float light = 0.08 + 0.92 * smoothstep(-0.15, 0.5, dot(N, L));
    vec3 col = vec3(0.92, 0.96, 1.0) * light;
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createCloudMaterial(cloudMap: THREE.Texture, sunDirection: THREE.Vector3, opacity = 0.72): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudMap },
      sunDirection: { value: sunDirection.clone().normalize() },
      opacity: { value: opacity },
    },
    vertexShader: EARTH_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    transparent: true,
    depthWrite: false,
    toneMapped: true,
  })
}

const ATMO_FRAGMENT = /* glsl */ `
  uniform vec3 sunDirection;
  uniform vec3 tint;
  uniform float intensity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - abs(dot(N, V)), 3.4);
    float sun = smoothstep(-0.42, 0.45, dot(N, normalize(sunDirection)));
    float a = rim * sun * intensity;
    gl_FragColor = vec4(tint * a, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createAtmosphereMaterial(sunDirection: THREE.Vector3, tint = "#3b82f6", intensity = 0.9): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: sunDirection.clone().normalize() },
      tint: { value: new THREE.Color(tint) },
      intensity: { value: intensity },
    },
    vertexShader: EARTH_VERTEX,
    fragmentShader: ATMO_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: true,
  })
}

const SUN_FRAGMENT = /* glsl */ `
  uniform sampler2D sunMap;
  uniform vec3 hotColor;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float mu = clamp(dot(N, V), 0.0, 1.0);
    float limb = 0.42 + 0.58 * pow(mu, 0.42);
    vec3 tex = texture2D(sunMap, vUv).rgb;
    vec3 col = tex * limb * 1.55;
    col += hotColor * pow(1.0 - mu, 3.0) * 0.65;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createSunMaterial(sunMap: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunMap: { value: sunMap },
      hotColor: { value: new THREE.Color("#ff8a3d") },
    },
    vertexShader: EARTH_VERTEX,
    fragmentShader: SUN_FRAGMENT,
    toneMapped: true,
  })
}

export function createGlowSprite(color: string, size: number, opacity: number, texture: THREE.Texture): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: texture,
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.setScalar(size)
  return sprite
}

export function earthSunDirection(date: Date): THREE.Vector3 {
  // The visible terminator is driven by the real subsolar point. This vector
  // is used for the small Earth views; the solar system uses a point light.
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const doy = (date.getTime() - start) / 86400000 + 1
  const decl = (-23.44 * Math.cos((2 * Math.PI * (doy + 10)) / 365.24)) * (Math.PI / 180)
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const b = (2 * Math.PI * (doy - 81)) / 364
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  let lon = ((180 - 15 * hours - eot / 4) * Math.PI) / 180
  lon = ((lon + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return new THREE.Vector3(
    Math.cos(decl) * Math.sin(lon),
    Math.sin(decl),
    Math.cos(decl) * Math.cos(lon),
  ).normalize()
}
