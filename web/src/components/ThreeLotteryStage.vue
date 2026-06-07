<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  names: {
    type: Array,
    default: () => []
  },
  poolNames: {
    type: Array,
    default: () => []
  },
  isDrawing: {
    type: Boolean,
    default: false
  },
  isRevealing: {
    type: Boolean,
    default: false
  },
  revealedCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['import-list'])

const canvasRef = ref(null)
const stageRef = ref(null)
const webglUnavailable = ref(false)
const stageSize = ref({ width: 0, height: 0 })
const phase = ref('empty')

const orbitLabelCount = 36
const intakeLabelCount = 36
const drawingLabelCount = 48
const resultPreviewLimit = computed(() => (stageSize.value.width > 0 && stageSize.value.width < 720 ? 40 : 80))
const resultNameLimit = computed(() => {
  if (props.names.length <= resultPreviewLimit.value) return resultPreviewLimit.value
  return Math.max(1, resultPreviewLimit.value - 1)
})
const resultNames = computed(() => props.names.slice(0, resultNameLimit.value))
const resultOverflowCount = computed(() => Math.max(0, props.names.length - resultNames.value.length))

const resultGridStyle = computed(() => {
  const count = props.names.length
  const visibleCount = Math.max(resultNames.value.length + (resultOverflowCount.value > 0 ? 1 : 0), 1)
  const isCompact = stageSize.value.width > 0 && stageSize.value.width < 720
  const columns = isCompact
    ? count <= 4
      ? Math.max(1, count)
      : count <= 12
        ? 3
        : count <= 30
          ? 4
          : 5
    : count <= 4
      ? Math.max(1, count)
      : count <= 12
        ? 4
        : count <= 30
          ? 6
          : 10

  return {
    gridTemplateColumns: `repeat(${Math.min(columns, visibleCount)}, minmax(0, 1fr))`
  }
})

let renderer = null
let scene = null
let camera = null
let labelGroup = null
let ringGroup = null
let tunnelGroup = null
let starField = null
let fusionCore = null
let frameId = 0
let resizeObserver = null
let clock = null
let phaseTimer = 0
let shuffleTimer = 0
let lastDeckKey = ''
let labelCards = []
let ringGeometry = null
let coreGeometry = null
const labelWorldPosition = new THREE.Vector3()

const sampleNames = (list, limit, randomize = false) => {
  const source = list.filter(Boolean)
  if (source.length <= limit) return randomize ? shuffle(source) : source

  if (randomize) {
    return shuffle(source).slice(0, limit)
  }

  const result = []
  const step = source.length / limit
  for (let i = 0; i < limit; i += 1) {
    result.push(source[Math.floor(i * step)])
  }
  return result
}

const shuffle = (list) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const clearPhaseTimer = () => {
  if (phaseTimer) {
    window.clearTimeout(phaseTimer)
    phaseTimer = 0
  }
}

const clearShuffleTimer = () => {
  if (shuffleTimer) {
    window.clearInterval(shuffleTimer)
    shuffleTimer = 0
  }
}

const setPhase = (nextPhase) => {
  phase.value = nextPhase
}

const enterEmpty = () => {
  clearPhaseTimer()
  clearShuffleTimer()
  setPhase('empty')
  rebuildDeck([], 'empty')
}

const enterIntake = () => {
  if (props.poolNames.length === 0) {
    enterEmpty()
    return
  }

  clearPhaseTimer()
  clearShuffleTimer()
  setPhase('intake')
  rebuildDeck(sampleNames(props.poolNames, intakeLabelCount, true), 'intake')
  phaseTimer = window.setTimeout(() => {
    enterOrbit()
  }, 2400)
}

const enterOrbit = () => {
  if (props.poolNames.length === 0) {
    enterEmpty()
    return
  }

  clearPhaseTimer()
  setPhase('orbit')
  const orbitNames = sampleNames(props.poolNames, orbitLabelCount, true)
  if (labelCards.length === orbitNames.length) refreshDeckNames(orbitNames, 'orbit')
  else rebuildDeck(orbitNames, 'orbit')
  clearShuffleTimer()
  shuffleTimer = window.setInterval(() => {
    if (phase.value !== 'orbit' || props.poolNames.length === 0) return
    refreshBackDeckNames(sampleNames(props.poolNames, orbitLabelCount, true), 'orbit')
  }, 950)
}

const enterClearing = () => {
  clearPhaseTimer()
  clearShuffleTimer()
  setPhase('clearing')
  phaseTimer = window.setTimeout(() => {
    enterDrawing()
  }, 720)
}

const enterDrawing = () => {
  if (props.poolNames.length === 0) return

  clearPhaseTimer()
  clearShuffleTimer()
  setPhase('drawing')
  rebuildDeck(sampleNames(props.poolNames, drawingLabelCount, true), 'drawing')
  shuffleTimer = window.setInterval(() => {
    if (phase.value !== 'drawing') return
    rebuildDeck(sampleNames(props.poolNames, drawingLabelCount, true), 'drawing')
  }, 260)
}

const enterFusion = () => {
  clearPhaseTimer()
  clearShuffleTimer()
  setPhase('fusion')
  rebuildDeck(sampleNames(props.poolNames.length > 0 ? props.poolNames : props.names, orbitLabelCount, true), 'fusion')
}

const enterResult = () => {
  clearPhaseTimer()
  clearShuffleTimer()
  setPhase('result')
  rebuildDeck(sampleNames(props.names, Math.min(orbitLabelCount, Math.max(props.names.length, 1)), false), 'result')
}

const makeLabelCanvas = (name, mode, index, variant = 'sharp') => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const width = 384
  const height = 146

  canvas.width = width
  canvas.height = height

  if (!context) return canvas

  const hue = (index * 29) % 360
  const isAnonymous = mode === 'drawing' || mode === 'fusion'
  const isResult = mode === 'result'
  const isBlurred = variant === 'blurred'
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, isAnonymous ? 'rgba(255, 246, 210, 0.94)' : isResult ? 'rgba(236, 255, 247, 0.96)' : 'rgba(238, 248, 255, 0.9)')
  gradient.addColorStop(1, isAnonymous ? 'rgba(255, 196, 72, 0.84)' : isResult ? 'rgba(199, 245, 226, 0.92)' : 'rgba(210, 232, 255, 0.78)')

  context.clearRect(0, 0, width, height)
  context.shadowColor = isAnonymous ? 'rgba(255, 210, 96, 0.86)' : `hsla(${hue}, 80%, 62%, 0.42)`
  context.shadowBlur = isAnonymous ? 30 : 16
  context.fillStyle = gradient
  context.strokeStyle = isAnonymous ? 'rgba(255, 228, 130, 0.86)' : isResult ? 'rgba(18, 145, 110, 0.72)' : `hsla(${hue}, 72%, 48%, 0.42)`
  context.lineWidth = isAnonymous ? 0 : 3
  roundRect(context, 10, 10, width - 20, height - 20, 18)
  context.fill()
  if (!isAnonymous) context.stroke()
  context.shadowBlur = 0

  const barGradient = context.createLinearGradient(28, 28, width - 28, 28)
  barGradient.addColorStop(0, isAnonymous ? 'rgba(255, 255, 255, 0.95)' : 'rgba(110, 206, 188, 0.22)')
  barGradient.addColorStop(1, isAnonymous ? 'rgba(255, 196, 64, 0.16)' : 'rgba(255, 255, 255, 0.12)')
  context.fillStyle = barGradient
  roundRect(context, 28, 28, width - 56, 16, 8)
  context.fill()

  if (isAnonymous) {
    context.globalAlpha = 0.8
    for (let i = 0; i < 5; i += 1) {
      const y = 60 + i * 11
      const lineWidth = 82 + Math.random() * 160
      context.fillStyle = `rgba(255, 255, 255, ${0.16 + i * 0.06})`
      roundRect(context, 64 + Math.random() * 80, y, lineWidth, 8, 4)
      context.fill()
    }
    context.globalAlpha = 1
    return canvas
  }

  const displayName = name.length > 8 ? `${name.slice(0, 8)}...` : name
  const fontSize = displayName.length >= 5 ? 42 : displayName.length >= 4 ? 48 : 56

  context.font = `900 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = isResult
    ? 'rgba(15, 64, 50, 0.98)'
    : isBlurred
      ? 'rgba(21, 45, 76, 0.24)'
      : 'rgba(21, 45, 76, 0.86)'
  context.shadowColor = isResult ? 'rgba(255, 255, 255, 0.8)' : 'rgba(93, 176, 218, 0.55)'
  context.shadowBlur = isBlurred ? 26 : mode === 'orbit' ? 8 : 4
  if (isBlurred) {
    context.filter = 'blur(3.2px)'
  }
  context.fillText(displayName, width / 2, height / 2 + 12)
  context.filter = 'none'

  return canvas
}

const createLabelTexture = (name, mode, index, variant = 'sharp') => {
  const texture = new THREE.CanvasTexture(makeLabelCanvas(name, mode, index, variant))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

const roundRect = (context, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

const rebuildDeck = (names, mode) => {
  if (!labelGroup) return

  const deckKey = `${mode}:${names.join('|')}`
  if (deckKey === lastDeckKey) return
  lastDeckKey = deckKey

  disposeLabels()
  names.forEach((name, index) => {
    const sharpTexture = createLabelTexture(name, mode, index, 'sharp')
    const blurTexture = mode === 'orbit'
      ? createLabelTexture(name, mode, index, 'blurred')
      : sharpTexture

    const material = new THREE.SpriteMaterial({
      map: sharpTexture,
      transparent: true,
      opacity: mode === 'intake' ? 0.28 : mode === 'drawing' ? 0.72 : 0.88,
      blending: mode === 'drawing' || mode === 'fusion' ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    })
    const sprite = new THREE.Sprite(material)
    const target = getSpherePosition(index, names.length)
    const start = mode === 'intake' ? getCenterBurstPosition(index) : target.clone()

    sprite.position.copy(start)
    sprite.scale.set(1.5, 0.56, 1)
    sprite.userData = {
      index,
      mode,
      age: 0,
      seed: Math.random() * 100,
      nameFade: 1,
      depthMode: 'sharp',
      start,
      centerPoint: new THREE.Vector3(
        (Math.random() - 0.5) * 0.42,
        (Math.random() - 0.5) * 0.26,
        -0.28 + Math.random() * 0.32
      ),
      target,
      fusionTarget: new THREE.Vector3(
        (Math.random() - 0.5) * 0.92,
        (Math.random() - 0.5) * 0.64,
        (Math.random() - 0.5) * 0.82
      )
    }

    labelGroup.add(sprite)
    labelCards.push({ mesh: sprite, material, sharpTexture, blurTexture })
  })
}

const refreshDeckNames = (names, mode) => {
  if (labelCards.length === 0 || labelCards.length !== names.length) {
    rebuildDeck(names, mode)
    return
  }

  const nextKey = `${mode}:${names.join('|')}`
  if (nextKey === lastDeckKey) return
  lastDeckKey = nextKey

  names.forEach((name, index) => {
    const card = labelCards[index]
    if (!card) return

    const nextSharpTexture = createLabelTexture(name, mode, index, 'sharp')
    const nextBlurTexture = mode === 'orbit'
      ? createLabelTexture(name, mode, index, 'blurred')
      : nextSharpTexture

    card.sharpTexture.dispose()
    if (card.blurTexture !== card.sharpTexture) card.blurTexture.dispose()
    card.sharpTexture = nextSharpTexture
    card.blurTexture = nextBlurTexture
    card.material.map = card.mesh.userData.depthMode === 'blurred' ? nextBlurTexture : nextSharpTexture
    card.material.needsUpdate = true
    card.material.opacity = 0.2
    card.mesh.userData.nameFade = 0
  })
}

const refreshBackDeckNames = (names, mode) => {
  if (labelCards.length === 0 || labelCards.length !== names.length) {
    rebuildDeck(names, mode)
    return
  }

  const nextKey = `${mode}:${names.join('|')}`
  if (nextKey === lastDeckKey) return
  lastDeckKey = nextKey

  const candidates = labelCards
    .map((card, index) => {
      card.mesh.getWorldPosition(labelWorldPosition)
      return { card, index, z: labelWorldPosition.z }
    })
    .sort((a, b) => a.z - b.z)
    .slice(0, 4)

  candidates.forEach(({ card, index }) => {
    const name = names[index]
    if (!name) return

    const nextSharpTexture = createLabelTexture(name, mode, index, 'sharp')
    const nextBlurTexture = createLabelTexture(name, mode, index, 'blurred')

    card.sharpTexture.dispose()
    if (card.blurTexture !== card.sharpTexture) card.blurTexture.dispose()
    card.sharpTexture = nextSharpTexture
    card.blurTexture = nextBlurTexture
    card.material.map = nextBlurTexture
    card.material.needsUpdate = true
    card.mesh.userData.depthMode = 'blurred'
    card.mesh.userData.nameFade = Math.max(0.72, card.mesh.userData.nameFade ?? 1)
  })
}

const getSpherePosition = (index, count) => {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (index / Math.max(count - 1, 1)) * 2
  const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = goldenAngle * index
  const radius = 4.2

  return new THREE.Vector3(
    Math.cos(theta) * radiusAtY * radius,
    y * radius * 0.78,
    Math.sin(theta) * radiusAtY * radius
  )
}

const getCenterBurstPosition = (index) => {
  const lane = index % 5
  const laneOffset = lane - 2
  const side = index % 2 === 0 ? -1 : 1
  const depth = Math.floor(index / 5)
  return new THREE.Vector3(
    side * (2.2 + Math.abs(laneOffset) * 0.9 + Math.random() * 0.5),
    2.7 - depth * 0.12 + laneOffset * 0.32,
    -7.5 - Math.random() * 3.5
  )
}

const createStarField = () => {
  const positions = []
  const colors = []
  const color = new THREE.Color()

  for (let i = 0; i < 420; i += 1) {
    const radius = 8 + Math.random() * 13
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions.push(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius,
      Math.sin(phi) * Math.sin(theta) * radius
    )
    color.setHSL(0.55 + Math.random() * 0.09, 0.62, 0.6 + Math.random() * 0.22)
    colors.push(color.r, color.g, color.b)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  })

  starField = new THREE.Points(geometry, material)
  scene.add(starField)
}

const createRings = () => {
  ringGroup = new THREE.Group()
  ringGeometry = new THREE.TorusGeometry(4.9, 0.018, 12, 220)
  const ringColors = [0x70c6ff, 0xffd36f, 0x66e7c2, 0xffffff]

  ringColors.forEach((color, index) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: index === 3 ? 0.26 : 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const ring = new THREE.Mesh(ringGeometry, material)
    ring.rotation.x = Math.PI / (1.7 + index * 0.22)
    ring.rotation.y = index * Math.PI / 4
    ring.scale.setScalar(1 + index * 0.12)
    ring.userData.speed = 0.003 + index * 0.0018
    ringGroup.add(ring)
  })

  scene.add(ringGroup)
}

const createTunnel = () => {
  tunnelGroup = new THREE.Group()
  const beamGeometry = new THREE.PlaneGeometry(0.12, 10)

  for (let i = 0; i < 16; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x9ed8ff : 0xffd889,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const beam = new THREE.Mesh(beamGeometry, material)
    const angle = (i / 16) * Math.PI * 2
    beam.position.set(Math.cos(angle) * 5.7, Math.sin(angle) * 3.2, -2.5)
    beam.rotation.z = angle
    beam.userData.speed = 0.002 + Math.random() * 0.002
    tunnelGroup.add(beam)
  }

  scene.add(tunnelGroup)
}

const createFusionCore = () => {
  coreGeometry = new THREE.SphereGeometry(0.78, 32, 16)
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd46b,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  fusionCore = new THREE.Mesh(coreGeometry, material)
  fusionCore.scale.setScalar(0.2)
  scene.add(fusionCore)
}

const initScene = () => {
  const canvas = canvasRef.value
  const stage = stageRef.value
  if (!canvas || !stage) return

  try {
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90)
    camera.position.set(0, 0.4, 10.4)

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))

    labelGroup = new THREE.Group()
    scene.add(labelGroup)
    createStarField()
    createRings()
    createTunnel()
    createFusionCore()
    resizeRenderer()
    syncPhaseFromProps(true)
    animate()

    resizeObserver = new ResizeObserver(resizeRenderer)
    resizeObserver.observe(stage)
  } catch (error) {
    console.warn('3D 舞台初始化失败', error)
    webglUnavailable.value = true
    disposeScene()
  }
}

const resizeRenderer = () => {
  if (!renderer || !camera || !stageRef.value) return

  const rect = stageRef.value.getBoundingClientRect()
  const width = Math.max(1, Math.floor(rect.width))
  const height = Math.max(1, Math.floor(rect.height))
  stageSize.value = { width, height }

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

const syncPhaseFromProps = (initial = false) => {
  if (props.isRevealing) {
    enterFusion()
    return
  }

  if (props.isDrawing) {
    if (!initial && props.names.length > 0) enterClearing()
    else enterDrawing()
    return
  }

  if (props.names.length > 0) {
    enterResult()
    return
  }

  if (props.poolNames.length > 0) {
    if (initial) enterOrbit()
    else enterIntake()
    return
  }

  enterEmpty()
}

const easeOutExpo = (value) => {
  if (value >= 1) return 1
  return 1 - Math.pow(2, -10 * value)
}

const animate = () => {
  if (!renderer || !scene || !camera || !labelGroup) return

  frameId = requestAnimationFrame(animate)
  const delta = Math.min(clock?.getDelta() ?? 0.016, 0.04)
  const elapsed = clock?.elapsedTime ?? 0
  const phaseName = phase.value
  const spinSpeed = phaseName === 'drawing'
    ? 0.07
    : phaseName === 'fusion'
      ? 0.045
      : phaseName === 'intake'
        ? 0.03
        : 0.009

  labelGroup.rotation.y += spinSpeed
  labelGroup.rotation.x = Math.sin(elapsed * 0.38) * 0.11

  if (ringGroup) {
    ringGroup.children.forEach((ring, index) => {
      ring.rotation.z += ring.userData.speed * (phaseName === 'drawing' ? 4.8 : phaseName === 'fusion' ? 6 : 1.5)
      ring.rotation.y += 0.0025 + index * 0.0008
      ring.material.opacity = phaseName === 'empty' ? 0.48 : phaseName === 'fusion' ? 0.72 : 0.38
    })
  }

  if (tunnelGroup) {
    tunnelGroup.rotation.z -= phaseName === 'fusion' ? 0.026 : phaseName === 'drawing' ? 0.018 : 0.004
    tunnelGroup.children.forEach((beam) => {
      beam.material.opacity = phaseName === 'fusion' ? 0.34 : phaseName === 'drawing' ? 0.24 : 0.1
    })
  }

  if (starField) {
    starField.rotation.y -= spinSpeed * 0.18
    starField.material.opacity = phaseName === 'drawing' || phaseName === 'fusion' ? 0.82 : 0.56
  }

  updateLabels(delta, elapsed, phaseName)
  updateFusionCore(elapsed, phaseName)

  const targetZ = phaseName === 'fusion' ? 7.8 : phaseName === 'drawing' ? 9.2 : 10.4
  camera.position.z += (targetZ - camera.position.z) * 0.045
  camera.position.y += ((phaseName === 'fusion' ? 0.08 : 0.4) - camera.position.y) * 0.035
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)
}

const updateLabels = (delta, elapsed, phaseName) => {
  labelCards.forEach((card) => {
    const { mesh, material } = card
    mesh.userData.age += delta
    const age = mesh.userData.age
    const seed = mesh.userData.seed

    if (phaseName === 'intake') {
      const progress = Math.min(age / 2.15, 1)
      const center = mesh.userData.centerPoint
      const target = mesh.userData.target

      if (progress < 0.48) {
        const flyIn = easeOutExpo(progress / 0.48)
        mesh.position.lerpVectors(mesh.userData.start, center, flyIn)
        mesh.position.x += Math.sin(elapsed * 18 + seed) * (1 - flyIn) * 0.18
        mesh.position.y += Math.cos(elapsed * 16 + seed) * (1 - flyIn) * 0.16
      } else {
        const spread = easeOutExpo((progress - 0.48) / 0.52)
        mesh.position.lerpVectors(center, target, spread)
        mesh.position.x += Math.sin(elapsed * 8 + seed) * (1 - spread) * 0.32
        mesh.position.y += Math.cos(elapsed * 7 + seed) * (1 - spread) * 0.24
      }

      material.opacity = Math.min(0.94, 0.3 + progress * 0.7)
      const scale = 1.08 + Math.sin(progress * Math.PI) * 0.72 + progress * 0.22
      mesh.scale.set(scale, scale * 0.38, 1)
      return
    }

    if (phaseName === 'drawing') {
      const target = mesh.userData.target
      mesh.position.x = target.x + Math.sin(elapsed * 16 + seed) * 0.45
      mesh.position.y = target.y + Math.cos(elapsed * 14 + seed) * 0.35
      mesh.position.z = target.z + Math.sin(elapsed * 12 + seed) * 0.5
      material.opacity = 0.48 + Math.sin(elapsed * 18 + seed) * 0.18
      const scale = 1.18 + Math.sin(elapsed * 18 + seed) * 0.16
      mesh.scale.set(scale, scale * 0.34, 1)
      return
    }

    if (phaseName === 'fusion') {
      const progress = easeOutExpo(Math.min(age / 1.1, 1))
      mesh.position.lerp(mesh.userData.fusionTarget, 0.12 + progress * 0.16)
      material.opacity = 0.72 + progress * 0.28
      const scale = 1.28 + progress * 0.72 + Math.sin(elapsed * 22 + seed) * 0.12
      mesh.scale.set(scale, scale * 0.38, 1)
      return
    }

    const base = mesh.userData.target
    mesh.position.copy(base)
    const scale = phaseName === 'result' ? 1.62 : 1.42
    mesh.scale.set(scale, scale * 0.38, 1)

    if (phaseName === 'orbit') {
      mesh.userData.nameFade = Math.min(1, (mesh.userData.nameFade ?? 1) + delta * 2.8)
      mesh.getWorldPosition(labelWorldPosition)
      // 相机在正 z 方向，z 越大越靠前；只有退到后面的卡片才使用模糊贴图。
      const frontFactor = Math.min(1, Math.max(0, (labelWorldPosition.z + 4.2) / 8.4))
      const previousDepthMode = mesh.userData.depthMode ?? 'sharp'
      const depthMode = frontFactor > 0.58
        ? 'sharp'
        : frontFactor < 0.32
          ? 'blurred'
          : previousDepthMode
      const nextMap = depthMode === 'sharp' ? card.sharpTexture : card.blurTexture

      if (mesh.userData.depthMode !== depthMode && material.map !== nextMap) {
        material.map = nextMap
        material.needsUpdate = true
        mesh.userData.depthMode = depthMode
      }

      material.opacity = (0.18 + frontFactor * 0.54) * mesh.userData.nameFade
      const depthScale = 1.18 + frontFactor * 0.34
      mesh.scale.set(depthScale, depthScale * 0.38, 1)
      return
    }

    material.opacity = phaseName === 'result' ? 0.78 : 0.62
  })
}

const updateFusionCore = (elapsed, phaseName) => {
  if (!fusionCore) return

  if (phaseName === 'fusion') {
    const pulse = 1 + Math.sin(elapsed * 18) * 0.18
    fusionCore.material.opacity += (0.88 - fusionCore.material.opacity) * 0.12
    fusionCore.scale.setScalar((1.2 + Math.sin(elapsed * 9) * 0.2) * pulse)
    return
  }

  fusionCore.material.opacity += (0 - fusionCore.material.opacity) * 0.08
  fusionCore.scale.setScalar(0.2)
}

const disposeLabels = () => {
  labelCards.forEach(({ mesh, material, sharpTexture, blurTexture }) => {
    labelGroup?.remove(mesh)
    sharpTexture.dispose()
    if (blurTexture !== sharpTexture) blurTexture.dispose()
    material.dispose()
  })
  labelCards = []
}

const disposeScene = () => {
  if (frameId) {
    cancelAnimationFrame(frameId)
    frameId = 0
  }

  clearPhaseTimer()
  clearShuffleTimer()
  resizeObserver?.disconnect()
  resizeObserver = null
  disposeLabels()

  if (starField) {
    scene?.remove(starField)
    starField.geometry.dispose()
    starField.material.dispose()
    starField = null
  }

  ringGroup?.children.forEach((child) => child.material?.dispose())
  scene?.remove(ringGroup)
  ringGroup = null
  ringGeometry?.dispose()
  ringGeometry = null

  tunnelGroup?.children.forEach((child) => {
    child.geometry?.dispose()
    child.material?.dispose()
  })
  scene?.remove(tunnelGroup)
  tunnelGroup = null

  if (fusionCore) {
    scene?.remove(fusionCore)
    fusionCore.material?.dispose()
    fusionCore = null
  }
  coreGeometry?.dispose()
  coreGeometry = null

  renderer?.dispose()
  renderer = null
  scene = null
  camera = null
  labelGroup = null
  lastDeckKey = ''
}

onMounted(async () => {
  clock = new THREE.Clock()
  await nextTick()
  initScene()
})

onBeforeUnmount(() => {
  disposeScene()
})

watch(() => props.poolNames.length, (newLength, oldLength) => {
  if (props.isDrawing || props.isRevealing || props.names.length > 0) return
  if (oldLength === 0 && newLength > 0) enterIntake()
  else if (newLength === 0) enterEmpty()
})

watch(() => props.isDrawing, (drawing, wasDrawing) => {
  if (drawing && !wasDrawing) {
    if (props.names.length > 0) enterClearing()
    else enterDrawing()
  }
})

watch(() => props.isRevealing, (revealing) => {
  if (revealing) enterFusion()
})

watch(() => [props.isDrawing, props.isRevealing, props.names.length], () => {
  if (!props.isDrawing && !props.isRevealing && props.names.length > 0) {
    enterResult()
  }
})
</script>

<template>
  <section
    ref="stageRef"
    class="three-stage"
    :class="`phase-${phase}`"
    aria-label="3D 抽签舞台"
  >
    <canvas v-show="!webglUnavailable" ref="canvasRef" class="three-canvas"></canvas>
    <div class="stage-lattice" aria-hidden="true"></div>
    <div class="stage-flare flare-left" aria-hidden="true"></div>
    <div class="stage-flare flare-right" aria-hidden="true"></div>
    <div class="stage-vortex" aria-hidden="true"></div>

    <div class="three-stage-topline">
      <span v-if="phase === 'empty'">3D 舞台</span>
      <span v-else-if="phase === 'intake'">名单入场</span>
      <span v-else-if="phase === 'drawing'">高速抽取</span>
      <span v-else-if="phase === 'fusion'">结果聚合</span>
      <span v-else-if="phase === 'clearing'">下一轮准备</span>
      <span v-else>本轮结果</span>
      <strong>{{ names.length || poolNames.length }} 人</strong>
    </div>

    <div v-if="webglUnavailable" class="three-fallback">
      当前浏览器无法启动 WebGL，已保留结果展示。
    </div>

    <button v-if="phase === 'empty'" type="button" class="stage-load-button" @click="emit('import-list')">
      导入名单
    </button>
  </section>
</template>

<style scoped>
.three-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 10px;
  background:
    radial-gradient(circle at 50% 48%, oklch(18% 0.06 260 / 0.92), oklch(7% 0.055 260 / 0.94) 36%, transparent 58%),
    radial-gradient(circle at 18% 16%, oklch(86% 0.1 205 / 0.56), transparent 27%),
    radial-gradient(circle at 84% 18%, oklch(89% 0.08 82 / 0.5), transparent 24%),
    linear-gradient(135deg, oklch(42% 0.16 260), oklch(24% 0.12 252) 42%, oklch(62% 0.11 205));
  border: 1px solid oklch(78% 0.08 225 / 0.32);
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.32), 0 18px 46px oklch(18% 0.08 260 / 0.24);
  isolation: isolate;
}

.three-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 2;
}

.stage-lattice {
  position: absolute;
  inset: -12%;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(45deg, transparent 47%, oklch(96% 0.02 240 / 0.44) 49%, transparent 51%),
    linear-gradient(-45deg, transparent 47%, oklch(96% 0.02 240 / 0.32) 49%, transparent 51%);
  background-size: 90px 90px;
  opacity: 0.58;
  animation: latticeDrift 9s linear infinite;
}

.stage-flare {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 28%;
  z-index: 3;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 18%, oklch(100% 0 0 / 0.9), transparent 7%),
    radial-gradient(circle at 50% 38%, oklch(100% 0 0 / 0.72), transparent 6%),
    radial-gradient(circle at 50% 62%, oklch(100% 0 0 / 0.64), transparent 7%),
    linear-gradient(90deg, oklch(90% 0.08 215 / 0.45), transparent);
  mix-blend-mode: screen;
}

.flare-left {
  left: 0;
}

.flare-right {
  right: 0;
  transform: scaleX(-1);
}

.stage-vortex {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 48%, oklch(98% 0.07 82 / 0.95), oklch(84% 0.16 82 / 0.42) 8%, transparent 24%),
    conic-gradient(from 0deg at 50% 48%, transparent, oklch(97% 0.08 80 / 0.45), transparent, oklch(91% 0.11 58 / 0.35), transparent);
  mix-blend-mode: screen;
}

.phase-fusion .stage-vortex {
  opacity: 1;
  animation: vortexFlash 1.1s ease-out infinite;
}

.three-stage-topline {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 8;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 13px;
  border-radius: 8px;
  border: 1px solid oklch(95% 0.02 245 / 0.38);
  background: oklch(16% 0.06 260 / 0.38);
  color: oklch(98% 0.01 245);
  font-size: 13px;
  font-weight: 850;
  box-shadow: 0 10px 28px oklch(9% 0.04 260 / 0.22);
  backdrop-filter: blur(8px);
}

.three-stage-topline strong {
  color: oklch(86% 0.14 82);
  font-weight: 950;
}

.stage-load-button {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 8;
  transform: translate(-50%, -50%);
  height: 52px;
  min-width: 148px;
  padding: 0 24px;
  border: 1px solid oklch(98% 0.02 245 / 0.52);
  border-radius: 999px;
  background:
    linear-gradient(180deg, oklch(99% 0.014 245 / 0.96), oklch(82% 0.12 216 / 0.92));
  color: oklch(22% 0.07 255);
  font: inherit;
  font-size: 17px;
  font-weight: 850;
  cursor: pointer;
  box-shadow: 0 0 38px oklch(84% 0.12 216 / 0.42), 0 16px 34px oklch(10% 0.07 260 / 0.26);
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.stage-load-button:hover {
  transform: translate(-50%, -50%) scale(1.04);
  filter: brightness(1.06);
  box-shadow: 0 0 52px oklch(84% 0.12 216 / 0.56), 0 18px 38px oklch(10% 0.07 260 / 0.3);
}

.three-result-panel {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  z-index: 9;
  display: grid;
  gap: 7px;
  max-height: min(45%, 360px);
  padding: 12px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid oklch(78% 0.08 166 / 0.44);
  background: oklch(99% 0.008 248 / 0.88);
  box-shadow: 0 0 0 1px oklch(100% 0 0 / 0.28), 0 22px 48px oklch(12% 0.08 260 / 0.28);
  animation: resultBlast 0.34s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.three-result-panel.is-clearing {
  animation: resultDropOut 0.72s cubic-bezier(0.72, 0, 0.8, 0.32) both;
}

.three-result-name {
  min-width: 0;
  height: clamp(31px, 5.2vh, 52px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  padding: 0 8px;
  border: 1px solid oklch(62% 0.1 166 / 0.38);
  background: linear-gradient(180deg, oklch(99% 0.008 248 / 0.96), oklch(92% 0.045 166 / 0.9));
  color: oklch(20% 0.03 252);
  font-size: clamp(14px, 1.55vw, 24px);
  font-weight: 950;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.three-result-name.is-more {
  color: oklch(42% 0.04 252);
  background: oklch(94% 0.018 248 / 0.88);
}

.three-fallback {
  position: absolute;
  top: 58px;
  left: 16px;
  z-index: 10;
  max-width: min(420px, calc(100% - 32px));
  padding: 10px 12px;
  border-radius: 8px;
  background: oklch(99% 0.008 248 / 0.88);
  border: 1px solid oklch(68% 0.04 248 / 0.28);
  color: oklch(38% 0.026 252);
  font-size: 13px;
  font-weight: 750;
}

@keyframes latticeDrift {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(90px, 90px, 0);
  }
}

@keyframes vortexFlash {
  0% {
    transform: scale(0.94) rotate(0deg);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.08) rotate(16deg);
    filter: brightness(1.45);
  }
  100% {
    transform: scale(0.94) rotate(32deg);
    filter: brightness(1);
  }
}

@keyframes resultBlast {
  from {
    opacity: 0;
    transform: scale(0.72) translateY(20px);
    filter: brightness(1.8) blur(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: brightness(1) blur(0);
  }
}

@keyframes resultDropOut {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(80px) scale(0.94);
  }
}

@media (max-width: 720px) {
  .three-stage-topline {
    top: 10px;
    left: 10px;
    height: 30px;
    font-size: 12px;
  }

  .three-result-panel {
    left: 10px;
    right: 10px;
    bottom: 10px;
    gap: 5px;
    padding: 8px;
    max-height: 48%;
  }

  .three-result-name {
    height: 30px;
    padding: 0 5px;
    font-size: 12px;
  }
}
</style>
