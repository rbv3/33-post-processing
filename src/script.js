import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass'
import { DotScreenPass } from 'three/examples/jsm/postprocessing/DotScreenPass'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader'
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'lil-gui'

/**
 * Base
 */
// Debug
const gui = new dat.GUI()

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scenea
const scene = new THREE.Scene()

/**
 * Loaders
 */
const gltfLoader = new GLTFLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()
const textureLoader = new THREE.TextureLoader()

/**
 * Update all materials
 */
const updateAllMaterials = () =>
{
    scene.traverse((child) =>
    {
        if(child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial)
        {
            child.material.envMapIntensity = 2.5
            child.material.needsUpdate = true
            child.castShadow = true
            child.receiveShadow = true
        }
    })
}

/**
 * Environment map
 */
const environmentMap = cubeTextureLoader.load([
    '/textures/environmentMaps/0/px.jpg',
    '/textures/environmentMaps/0/nx.jpg',
    '/textures/environmentMaps/0/py.jpg',
    '/textures/environmentMaps/0/ny.jpg',
    '/textures/environmentMaps/0/pz.jpg',
    '/textures/environmentMaps/0/nz.jpg'
])

scene.background = environmentMap
scene.environment = environmentMap

/**
 * Models
 */
gltfLoader.load(
    '/models/DamagedHelmet/glTF/DamagedHelmet.gltf',
    (gltf) =>
    {
        gltf.scene.scale.set(2, 2, 2)
        gltf.scene.rotation.y = Math.PI * 0.5
        scene.add(gltf.scene)

        updateAllMaterials()
    }
)

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 3)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.normalBias = 0.05
directionalLight.position.set(0.25, 3, - 2.25)
scene.add(directionalLight)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Update EffectComposer
    effectComposer.setSize(sizes.width, sizes.height)
    effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4, 1, - 4)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ReinhardToneMapping
renderer.toneMappingExposure = 1.5
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/*
    Post Processing
*/
// Render Target
const renderTarget = new THREE.WebGLRenderTarget(
    800,
    600, 
    {
        samples: renderer.getPixelRatio() === 1 ? 2 : 0
    }
)
// EffectComposer
const effectComposer = new EffectComposer(renderer, renderTarget)
effectComposer.setPixelRatio(renderer.getPixelRatio())
effectComposer.setSize(sizes.width, sizes.height)

// Passes
const renderPass = new RenderPass(scene, camera)

const dotScreenPass = new DotScreenPass()
dotScreenPass.enabled = false
gui.add(dotScreenPass, 'enabled').name('Enable DotScreen')

const glitchPass = new GlitchPass()
glitchPass.enabled = false
gui.add(glitchPass, 'enabled').name('Enable Glitch')


const rgbShiftPass = new ShaderPass(RGBShiftShader)
rgbShiftPass.enabled = false
gui.add(rgbShiftPass, 'enabled').name('Enable RGBShift')

const gammaCorrectionShader = new ShaderPass(GammaCorrectionShader)
gammaCorrectionShader.enabled = true

const smaaPass = new SMAAPass()
smaaPass.enabled = false
if(renderer.getPixelRatio() === 1 && !renderer.capabilities.isWebGL2) {
    smaaPass.enabled = true
}

const unrealBloomPass = new UnrealBloomPass()
unrealBloomPass.strength = 0.3
unrealBloomPass.radius = 1
unrealBloomPass.threshold = 0.6
unrealBloomPass.enabled = true
gui.add(unrealBloomPass, 'enabled').name('Enable UnrealBloom')
const unrealBloomFolder = gui.addFolder('Unreal Bloom properties')
unrealBloomFolder.close()
unrealBloomFolder.add(unrealBloomPass, 'strength').min(0).max(1).step(0.01).name('strength')
unrealBloomFolder.add(unrealBloomPass, 'radius').min(0).max(1).step(0.01).name('radius')
unrealBloomFolder.add(unrealBloomPass, 'threshold').min(0).max(1).step(0.01).name('threshold')

// Custom Passes
// Tint Pass
const TintShader = {
    uniforms : {
        tDiffuse: { value: null }, // previous RenderTarget
        uTint: { value: null }
    },
    vertexShader: `
        varying vec2 vUv;

        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            vUv = uv;
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uTint;

        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            color.rgb += uTint;
            gl_FragColor = vec4(color);
        }
    `
}
const tintPass = new ShaderPass(TintShader)
tintPass.material.uniforms.uTint.value = new THREE.Vector3(0.1, 0.1, 0.0);
tintPass.enabled = false;

gui.add(tintPass, 'enabled').name('Enable Tint')
const tintPassFolder = gui.addFolder('Tint properties')
tintPassFolder.close()
tintPassFolder.add(tintPass.material.uniforms.uTint.value, 'x').min(0).max(1).step(0.001).name('red')
tintPassFolder.add(tintPass.material.uniforms.uTint.value, 'y').min(0).max(1).step(0.001).name('green')
tintPassFolder.add(tintPass.material.uniforms.uTint.value, 'z').min(0).max(1).step(0.001).name('blue')

// Displacement Pass
const DisplacementShader = {
    uniforms : {
        tDiffuse: { value: null }, // previous RenderTarget
        uTime: { value: null }, 
        uSpeed: { value: null }, 
        uAmplitude: { value: null }, 
    },
    vertexShader: `
        varying vec2 vUv;

        void main() {            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            vUv = uv;
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uSpeed;
        uniform float uAmplitude;

        varying vec2 vUv;

        void main() {
            vec2 newUv = vec2(
                vUv.x,
                vUv.y + sin(
                    (vUv.x * 10.0) + (uTime * uSpeed)
                ) * uAmplitude
            );
            vec4 color = texture2D(tDiffuse, newUv);
            gl_FragColor = vec4(color);
        }
    `
}
const displacementPass = new ShaderPass(DisplacementShader)
displacementPass.material.uniforms.uTime.value = 0;
displacementPass.material.uniforms.uSpeed.value = 1;
displacementPass.material.uniforms.uAmplitude.value = 0.05;
displacementPass.enabled = false;

gui.add(displacementPass, 'enabled').name('Enable Displacement')
const displacementFolder = gui.addFolder('Displacement properties')
displacementFolder.close()
displacementFolder.add(displacementPass.material.uniforms.uSpeed, 'value').min(0).max(3).step(0.01).name('speed')
displacementFolder.add(displacementPass.material.uniforms.uAmplitude, 'value').min(0).max(0.3).step(0.001).name('amplitude')

// Futuristic Displacement Pass
const TextureDisplacementShader = {
    uniforms : {
        tDiffuse: { value: null }, // previous RenderTarget
        uNormalMap: { value: null },
        uLightDirection: { value: null },
        uLightStrength: { value: null },
    },
    vertexShader: `
        varying vec2 vUv;

        void main() {            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            vUv = uv;
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D uNormalMap;
        uniform vec3 uLightDirection;
        uniform float uLightStrength;

        varying vec2 vUv;

        void main() {
            vec3 normalColor = texture2D(uNormalMap, vUv).rgb * 2.0 - 1.0; // -1 to 1
            vec2 newUv = vUv + normalColor.xy * 0.1;

            vec4 color = texture2D(tDiffuse, newUv);

            vec3 lightDirection = normalize(uLightDirection);
            float lightness = clamp(
                dot(normalColor, lightDirection),
                0.0,
                1.0
            );

            color.rgb += lightness * uLightStrength;

            gl_FragColor = vec4(color);
        }
    `
}
const textureDisplacementShader = new ShaderPass(TextureDisplacementShader)
textureDisplacementShader.material.uniforms.uNormalMap.value = textureLoader.load(
    '/textures/interfaceNormalMap.png'
)
textureDisplacementShader.material.uniforms.uLightDirection.value = new THREE.Vector3(-1, 1, 0);
textureDisplacementShader.material.uniforms.uLightStrength.value = 1;
textureDisplacementShader.enabled = true;

gui.add(textureDisplacementShader, 'enabled').name('Enable Texture Displacement')

const textureDisplacementFolder = gui.addFolder('Texture Displacement properties')
textureDisplacementFolder.close()
textureDisplacementFolder.add(textureDisplacementShader.material.uniforms.uLightDirection.value, 'x').min(-1).max(1).step(0.1).name('light direction X')
textureDisplacementFolder.add(textureDisplacementShader.material.uniforms.uLightDirection.value, 'y').min(-1).max(1).step(0.1).name('light direction Y')
textureDisplacementFolder.add(textureDisplacementShader.material.uniforms.uLightStrength, 'value').min(0).max(4).step(0.01).name('light strength')

effectComposer.addPass(renderPass)
effectComposer.addPass(dotScreenPass)
effectComposer.addPass(glitchPass)
effectComposer.addPass(rgbShiftPass)
effectComposer.addPass(unrealBloomPass)
effectComposer.addPass(tintPass)
effectComposer.addPass(displacementPass)
effectComposer.addPass(textureDisplacementShader)
effectComposer.addPass(gammaCorrectionShader) // should be the last traditional pass
effectComposer.addPass(smaaPass) // all Anti-alias pass should be the last

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update passes
    displacementPass.material.uniforms.uTime.value = elapsedTime;


    // Update controls
    controls.update()

    // Render
    effectComposer.render()

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()