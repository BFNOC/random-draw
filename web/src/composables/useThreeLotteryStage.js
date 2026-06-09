import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { createThreeLotteryDeck } from '../utils/threeLotteryDeck'
import { createThreeLotteryObjects } from '../utils/threeLotteryObjects'
import { createThreeLotteryPhaseController } from '../utils/threeLotteryPhases'
import { createThreeLotteryRenderer } from '../utils/threeLotteryRenderer'

export const useThreeLotteryStage = (props) => {
  const canvasRef = ref(null)
  const stageRef = ref(null)
  const webglUnavailable = ref(false)
  const stageSize = ref({ width: 0, height: 0 })
  const phase = ref('empty')
  const runtime = createRuntime()
  const deck = createThreeLotteryDeck({ stageSize })
  const objects = createThreeLotteryObjects({ burstParticleCount: runtime.burstParticleCount })
  let controller = null
  let rendererApi = null

  const resizeRenderer = () => {
    if (!runtime.renderer || !runtime.camera || !stageRef.value) return

    const rect = stageRef.value.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    stageSize.value = { width, height }
    runtime.renderer.setSize(width, height, false)
    runtime.camera.aspect = width / height
    runtime.camera.updateProjectionMatrix()
  }

  const initScene = () => {
    const canvas = canvasRef.value
    const stage = stageRef.value
    if (!canvas || !stage) return

    try {
      initThreeRuntime(runtime, canvas)
      runtime.scene.add(deck.labelGroup)
      objects.mount(runtime.scene)
      controller = createThreeLotteryPhaseController(props, phase, deck, objects, runtime)
      rendererApi = createThreeLotteryRenderer(runtime, deck, objects, phase)
      resizeRenderer()
      controller.syncFromProps(true)
      rendererApi.start()
      runtime.resizeObserver = new ResizeObserver(resizeRenderer)
      runtime.resizeObserver.observe(stage)
    } catch (error) {
      console.warn('3D 舞台初始化失败', error)
      webglUnavailable.value = true
      disposeScene()
    }
  }

  const disposeScene = () => {
    rendererApi?.stop()
    controller?.dispose()
    runtime.resizeObserver?.disconnect()
    runtime.resizeObserver = null
    deck.dispose()
    objects.dispose(runtime.scene)
    runtime.renderer?.dispose()
    runtime.renderer = null
    runtime.scene = null
    runtime.camera = null
    controller = null
    rendererApi = null
  }

  onMounted(async () => {
    runtime.clock = new THREE.Clock()
    await nextTick()
    initScene()
  })

  onBeforeUnmount(disposeScene)
  registerThreeLotteryStageWatchers(props, () => controller)

  return {
    canvasRef,
    phase,
    stageRef,
    webglUnavailable
  }
}

const registerThreeLotteryStageWatchers = (props, getController) => {
  watch(() => props.poolNames.length, (newLength, oldLength) => {
    if (props.isDrawing || props.isRevealing || props.names.length > 0) return
    if (oldLength === 0 && newLength > 0) getController()?.enterIntake()
    else if (newLength === 0) getController()?.enterEmpty()
  })

  watch(() => props.isDrawing, (drawing, wasDrawing) => {
    if (!drawing || wasDrawing) return
    if (props.names.length > 0) getController()?.enterClearing()
    else getController()?.enterDrawing()
  })

  watch(() => props.isRevealing, (revealing) => {
    if (revealing && !props.isBursting) getController()?.enterFusion()
  })

  watch(() => props.isBursting, (bursting) => {
    if (bursting) getController()?.enterBurst()
  })

  watch(() => [props.isDrawing, props.isRevealing, props.names.length], () => {
    if (!props.isDrawing && !props.isRevealing && !props.isBursting && props.names.length > 0) {
      getController()?.enterResult()
    }
  })
}

const createRuntime = () => ({
  burstParticleCount: 180,
  burstStartTime: 0,
  camera: null,
  clock: null,
  renderer: null,
  resizeObserver: null,
  scene: null
})

const initThreeRuntime = (runtime, canvas) => {
  runtime.scene = new THREE.Scene()
  runtime.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90)
  runtime.camera.position.set(0, 0.4, 10.4)
  runtime.renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  })
  runtime.renderer.setClearColor(0x000000, 0)
  runtime.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
}
