import * as THREE from "three"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"

/**
 * Selective post-processing for the space scene.
 *
 * Applies a gentle UnrealBloom pass so that bright emissive sources (the Sun,
 * stars, nebulae, glow sprites) bloom naturally while dark vacuum stays black.
 * OutputPass is always last, applying tone mapping and output colour space once.
 *
 * Follows threejs-postprocessing skill guidance: bloom before OutputPass;
 * composer.render() replaces renderer.render().
 */
export interface PostProcessing {
  composer: EffectComposer
  bloomPass: UnrealBloomPass
  render: (dt: number) => void
  setSize: (width: number, height: number) => void
  dispose: () => void
}

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostProcessing {
  const composer = new EffectComposer(renderer)

  // 1. Render the scene into the composer's linear buffers.
  composer.addPass(new RenderPass(scene, camera))

  // 2. Bloom: threshold above diffuse surfaces so only bright sources glow.
  //    strength 0.12 keeps it subtle; radius 0.6 spreads the glow softly.
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.12, // strength
    0.6,  // radius
    1.1,  // threshold — only luminance above this glows
  )
  composer.addPass(bloomPass)

  // 3. OutputPass last: tone mapping + output color space, applied once.
  composer.addPass(new OutputPass())

  return {
    composer,
    bloomPass,
    render(dt: number) {
      composer.render(dt)
    },
    setSize(width: number, height: number) {
      composer.setSize(width, height)
    },
    dispose() {
      composer.dispose()
    },
  }
}
