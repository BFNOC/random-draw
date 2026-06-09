import * as THREE from 'three'

export const createThreeLotteryObjects = ({ burstParticleCount }) => {
  const objects = {
    burstParticleData: [],
    burstParticles: null,
    coreGeometry: null,
    fusionCore: null,
    ringGeometry: null,
    ringGroup: null,
    starField: null,
    tunnelGroup: null
  }

  const mount = (scene) => {
    objects.starField = createStarField()
    objects.ringGroup = createRings(objects)
    objects.tunnelGroup = createTunnel()
    objects.fusionCore = createFusionCore(objects)
    objects.burstParticles = createBurstParticles(burstParticleCount)
    scene.add(objects.starField, objects.ringGroup, objects.tunnelGroup, objects.fusionCore, objects.burstParticles)
  }

  const resetBurstParticles = () => {
    if (!objects.burstParticles) return
    resetParticlePositions(objects, burstParticleCount)
  }

  const dispose = (scene) => {
    disposeStarField(scene, objects)
    disposeRingGroup(scene, objects.ringGroup)
    disposeChildGroup(scene, objects.tunnelGroup)
    disposeCore(scene, objects)
    disposeMesh(scene, objects.burstParticles)
    objects.ringGeometry?.dispose()
    objects.burstParticleData = []
    objects.ringGeometry = null
    objects.ringGroup = null
    objects.tunnelGroup = null
    objects.burstParticles = null
  }

  objects.dispose = dispose
  objects.mount = mount
  objects.resetBurstParticles = resetBurstParticles
  return objects
}

const createStarField = () => {
  const positions = []
  const colors = []
  const color = new THREE.Color()

  for (let i = 0; i < 420; i += 1) {
    const radius = 8 + Math.random() * 13
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions.push(Math.sin(phi) * Math.cos(theta) * radius, Math.cos(phi) * radius, Math.sin(phi) * Math.sin(theta) * radius)
    color.setHSL(0.55 + Math.random() * 0.09, 0.62, 0.6 + Math.random() * 0.22)
    colors.push(color.r, color.g, color.b)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  }))
}

const createRings = (objects) => {
  const ringGroup = new THREE.Group()
  objects.ringGeometry = new THREE.TorusGeometry(4.9, 0.018, 12, 220)
  ;[0x70c6ff, 0xffd36f, 0x66e7c2, 0xffffff].forEach((color, index) => {
    const ring = createRing(objects.ringGeometry, color, index)
    ringGroup.add(ring)
  })
  return ringGroup
}

const createRing = (geometry, color, index) => {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: index === 3 ? 0.26 : 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const ring = new THREE.Mesh(geometry, material)
  ring.rotation.x = Math.PI / (1.7 + index * 0.22)
  ring.rotation.y = index * Math.PI / 4
  ring.scale.setScalar(1 + index * 0.12)
  ring.userData.speed = 0.003 + index * 0.0018
  return ring
}

const createTunnel = () => {
  const tunnelGroup = new THREE.Group()
  const beamGeometry = new THREE.PlaneGeometry(0.12, 10)

  for (let i = 0; i < 16; i += 1) {
    const beam = createBeam(beamGeometry, i)
    tunnelGroup.add(beam)
  }
  return tunnelGroup
}

const createBeam = (geometry, index) => {
  const material = new THREE.MeshBasicMaterial({
    color: index % 2 === 0 ? 0x9ed8ff : 0xffd889,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const beam = new THREE.Mesh(geometry, material)
  const angle = (index / 16) * Math.PI * 2
  beam.position.set(Math.cos(angle) * 5.7, Math.sin(angle) * 3.2, -2.5)
  beam.rotation.z = angle
  beam.userData.speed = 0.002 + Math.random() * 0.002
  return beam
}

const createFusionCore = (objects) => {
  objects.coreGeometry = new THREE.SphereGeometry(0.78, 32, 16)
  const core = new THREE.Mesh(objects.coreGeometry, new THREE.MeshBasicMaterial({
    color: 0xffd46b,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }))
  core.scale.setScalar(0.2)
  return core
}

const createBurstParticles = (burstParticleCount) => {
  const positions = new Float32Array(burstParticleCount * 3)
  const colors = new Float32Array(burstParticleCount * 3)
  const color = new THREE.Color()

  for (let i = 0; i < burstParticleCount; i += 1) {
    color.setHSL(i % 3 === 0 ? 0.13 : i % 3 === 1 ? 0.56 : 0.46, 0.86, 0.66)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.075,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }))
  particles.visible = false
  return particles
}

const resetParticlePositions = (objects, burstParticleCount) => {
  const positionAttribute = objects.burstParticles.geometry.getAttribute('position')
  const positions = positionAttribute.array
  objects.burstParticleData = []

  for (let i = 0; i < burstParticleCount; i += 1) {
    const direction = new THREE.Vector3((Math.random() - 0.5) * 1.9, (Math.random() - 0.5) * 1.16, 1 + Math.random() * 0.45).normalize()
    positions[i * 3] = 0
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = 0
    objects.burstParticleData.push({ direction, spread: 4.8 + Math.random() * 2.8, delay: Math.random() * 0.07 })
  }

  positionAttribute.needsUpdate = true
  objects.burstParticles.rotation.z = Math.random() * Math.PI
  objects.burstParticles.material.opacity = 0
  objects.burstParticles.visible = true
}

const disposeStarField = (scene, objects) => {
  disposeMesh(scene, objects.starField)
  objects.starField = null
}

const disposeRingGroup = (scene, group) => {
  group?.children.forEach((child) => child.material?.dispose())
  scene?.remove(group)
}

const disposeChildGroup = (scene, group) => {
  group?.children.forEach((child) => {
    child.geometry?.dispose()
    child.material?.dispose()
  })
  scene?.remove(group)
}

const disposeCore = (scene, objects) => {
  if (objects.fusionCore) {
    scene?.remove(objects.fusionCore)
    objects.fusionCore.material?.dispose()
    objects.fusionCore = null
  }
  objects.coreGeometry?.dispose()
  objects.coreGeometry = null
}

const disposeMesh = (scene, mesh) => {
  if (!mesh) return
  scene?.remove(mesh)
  mesh.geometry?.dispose()
  mesh.material?.dispose()
}
