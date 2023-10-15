import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass'
import { DotScreenPass } from 'three/examples/jsm/postprocessing/DotScreenPass'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader'
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader'
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

const glitchPass = new GlitchPass()
glitchPass.enabled = true

const rgbShiftPass = new ShaderPass(RGBShiftShader)
rgbShiftPass.enabled = false

const gammaCorrectionShader = new ShaderPass(GammaCorrectionShader)
gammaCorrectionShader.enabled = true

const smaaPass = new SMAAPass()
smaaPass.enabled = false
if(renderer.getPixelRatio() === 1 && !renderer.capabilities.isWebGL2) {
    smaaPass.enabled = true
}

effectComposer.addPass(renderPass)
effectComposer.addPass(dotScreenPass)
effectComposer.addPass(glitchPass)
effectComposer.addPass(rgbShiftPass)
effectComposer.addPass(gammaCorrectionShader) // should be the last traditional pass
effectComposer.addPass(smaaPass) // all Anti-alias pass should be the last

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update()

    // Render
    effectComposer.render()

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()