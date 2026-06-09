export const createThreeLotteryRenderer = (runtime, deck, objects, phase) => {
  let frameId = 0

  const animate = () => {
    if (!runtime.renderer || !runtime.scene || !runtime.camera || !deck.labelGroup) return
    frameId = requestAnimationFrame(animate)
    renderFrame(runtime, deck, objects, phase.value)
  }

  return {
    start() {
      animate()
    },
    stop() {
      if (!frameId) return
      cancelAnimationFrame(frameId)
      frameId = 0
    }
  }
}

const renderFrame = (runtime, deck, objects, phaseName) => {
  const delta = Math.min(runtime.clock?.getDelta() ?? 0.016, 0.04)
  const elapsed = runtime.clock?.elapsedTime ?? 0
  const spinSpeed = getSpinSpeed(phaseName)

  updateSceneMotion(deck, objects, spinSpeed, phaseName, elapsed)
  updateLabels(deck, delta, elapsed, phaseName)
  updateFusionCore(objects.fusionCore, elapsed, phaseName, runtime.burstStartTime)
  updateBurstParticles(objects, delta, elapsed, phaseName, runtime.burstStartTime)
  updateCamera(runtime.camera, phaseName)
  runtime.renderer.render(runtime.scene, runtime.camera)
}

const getSpinSpeed = (phaseName) => {
  if (phaseName === 'drawing') return 0.07
  if (phaseName === 'burst') return 0.018
  if (phaseName === 'fusion') return 0.045
  if (phaseName === 'intake') return 0.03
  return 0.009
}

const updateSceneMotion = (deck, objects, spinSpeed, phaseName, elapsed) => {
  deck.labelGroup.rotation.y += spinSpeed
  deck.labelGroup.rotation.x = Math.sin(elapsed * 0.38) * 0.11
  updateRings(objects.ringGroup, phaseName)
  updateTunnel(objects.tunnelGroup, phaseName)
  updateStarField(objects.starField, spinSpeed, phaseName)
}

const updateRings = (ringGroup, phaseName) => {
  if (!ringGroup) return
  ringGroup.children.forEach((ring, index) => {
    ring.rotation.z += ring.userData.speed * getRingSpeedMultiplier(phaseName)
    ring.rotation.y += 0.0025 + index * 0.0008
    ring.material.opacity = getRingOpacity(phaseName)
  })
}

const updateTunnel = (tunnelGroup, phaseName) => {
  if (!tunnelGroup) return
  tunnelGroup.rotation.z -= getTunnelSpeed(phaseName)
  tunnelGroup.children.forEach((beam) => {
    beam.material.opacity = getTunnelOpacity(phaseName)
  })
}

const updateStarField = (starField, spinSpeed, phaseName) => {
  if (!starField) return
  starField.rotation.y -= spinSpeed * 0.18
  starField.material.opacity = phaseName === 'drawing' || phaseName === 'fusion' || phaseName === 'burst' ? 0.82 : 0.56
}

const updateLabels = (deck, delta, elapsed, phaseName) => {
  deck.cards.forEach((card) => {
    const { mesh, material } = card
    mesh.userData.age += delta
    updateLabelByPhase(deck, card, mesh, material, delta, elapsed, phaseName)
  })
}

const updateLabelByPhase = (deck, card, mesh, material, delta, elapsed, phaseName) => {
  const age = mesh.userData.age
  const seed = mesh.userData.seed
  if (phaseName === 'intake') return updateIntakeLabel(mesh, material, elapsed, age, seed)
  if (phaseName === 'drawing') return updateDrawingLabel(mesh, material, elapsed, seed)
  if (phaseName === 'fusion') return updateFusionLabel(mesh, material, elapsed, age, seed)
  if (phaseName === 'burst') return updateBurstLabel(mesh, material, elapsed, age, seed)
  if (phaseName === 'orbit') return updateOrbitLabel(deck, card, mesh, material, delta)
  return updateStableLabel(mesh, material, phaseName)
}

const updateIntakeLabel = (mesh, material, elapsed, age, seed) => {
  const progress = Math.min(age / 2.15, 1)
  const center = mesh.userData.centerPoint
  const target = mesh.userData.target
  if (progress < 0.48) updateIntakeFlyIn(mesh, elapsed, seed, progress, center)
  else updateIntakeSpread(mesh, elapsed, seed, progress, center, target)
  material.opacity = Math.min(0.94, 0.3 + progress * 0.7)
  const scale = 1.08 + Math.sin(progress * Math.PI) * 0.72 + progress * 0.22
  mesh.scale.set(scale, scale * 0.38, 1)
}

const updateIntakeFlyIn = (mesh, elapsed, seed, progress, center) => {
  const flyIn = easeOutExpo(progress / 0.48)
  mesh.position.lerpVectors(mesh.userData.start, center, flyIn)
  mesh.position.x += Math.sin(elapsed * 18 + seed) * (1 - flyIn) * 0.18
  mesh.position.y += Math.cos(elapsed * 16 + seed) * (1 - flyIn) * 0.16
}

const updateIntakeSpread = (mesh, elapsed, seed, progress, center, target) => {
  const spread = easeOutExpo((progress - 0.48) / 0.52)
  mesh.position.lerpVectors(center, target, spread)
  mesh.position.x += Math.sin(elapsed * 8 + seed) * (1 - spread) * 0.32
  mesh.position.y += Math.cos(elapsed * 7 + seed) * (1 - spread) * 0.24
}

const updateDrawingLabel = (mesh, material, elapsed, seed) => {
  const target = mesh.userData.target
  mesh.position.x = target.x + Math.sin(elapsed * 16 + seed) * 0.45
  mesh.position.y = target.y + Math.cos(elapsed * 14 + seed) * 0.35
  mesh.position.z = target.z + Math.sin(elapsed * 12 + seed) * 0.5
  material.opacity = 0.48 + Math.sin(elapsed * 18 + seed) * 0.18
  const scale = 1.18 + Math.sin(elapsed * 18 + seed) * 0.16
  mesh.scale.set(scale, scale * 0.34, 1)
}

const updateFusionLabel = (mesh, material, elapsed, age, seed) => {
  const progress = easeOutExpo(Math.min(age / 1.1, 1))
  mesh.position.lerp(mesh.userData.fusionTarget, 0.12 + progress * 0.16)
  material.opacity = 0.72 + progress * 0.28
  const scale = 1.28 + progress * 0.72 + Math.sin(elapsed * 22 + seed) * 0.12
  mesh.scale.set(scale, scale * 0.38, 1)
}

const updateBurstLabel = (mesh, material, elapsed, age, seed) => {
  const progress = Math.min(age / 0.45, 1)
  const spread = easeOutExpo(progress)
  const flare = Math.sin(Math.min(progress, 1) * Math.PI)
  mesh.position.lerpVectors(mesh.userData.start, mesh.userData.target, spread)
  mesh.position.x += Math.sin(elapsed * 16 + seed) * flare * 0.12
  mesh.position.y += Math.cos(elapsed * 14 + seed) * flare * 0.1
  material.opacity = progress < 0.14 ? progress / 0.14 : Math.max(0.28, 0.96 - Math.max(0, progress - 0.72) * 1.9)
  const scale = 0.46 + spread * 1.55 + flare * 0.28
  mesh.scale.set(scale, scale * 0.38, 1)
}

const updateOrbitLabel = (deck, card, mesh, material, delta) => {
  mesh.position.copy(mesh.userData.target)
  mesh.userData.nameFade = Math.min(1, (mesh.userData.nameFade ?? 1) + delta * 2.8)
  mesh.getWorldPosition(deck.labelWorldPosition)
  // 相机在正 z 方向，z 越大越靠前；只有退到后面的卡片才使用模糊贴图。
  const frontFactor = Math.min(1, Math.max(0, (deck.labelWorldPosition.z + 4.2) / 8.4))
  const depthMode = getLabelDepthMode(mesh, frontFactor)
  const nextMap = depthMode === 'sharp' ? card.sharpTexture : card.blurTexture
  if (mesh.userData.depthMode !== depthMode && material.map !== nextMap) {
    material.map = nextMap
    material.needsUpdate = true
    mesh.userData.depthMode = depthMode
  }
  material.opacity = (0.18 + frontFactor * 0.54) * mesh.userData.nameFade
  const depthScale = 1.18 + frontFactor * 0.34
  mesh.scale.set(depthScale, depthScale * 0.38, 1)
}

const updateStableLabel = (mesh, material, phaseName) => {
  mesh.position.copy(mesh.userData.target)
  const scale = phaseName === 'result' ? 1.62 : 1.42
  mesh.scale.set(scale, scale * 0.38, 1)
  material.opacity = phaseName === 'result' ? 0.78 : 0.62
}

const updateFusionCore = (fusionCore, elapsed, phaseName, burstStartTime = 0) => {
  if (!fusionCore) return
  if (phaseName === 'burst') return updateBurstCore(fusionCore, elapsed, burstStartTime)
  if (phaseName === 'fusion') return updateFusionPulse(fusionCore, elapsed)
  fusionCore.material.opacity += (0 - fusionCore.material.opacity) * 0.08
  fusionCore.scale.setScalar(0.2)
}

const updateBurstCore = (fusionCore, elapsed, burstStartTime) => {
  const age = Math.max(0, elapsed - burstStartTime)
  const progress = easeOutExpo(Math.min(age / 0.31, 1))
  const fade = Math.max(0, 1 - Math.max(0, age - 0.21) / 0.25)
  fusionCore.material.opacity = 0.98 * fade
  fusionCore.scale.setScalar(0.7 + progress * 3.2)
}

const updateFusionPulse = (fusionCore, elapsed) => {
  const pulse = 1 + Math.sin(elapsed * 18) * 0.18
  fusionCore.material.opacity += (0.88 - fusionCore.material.opacity) * 0.12
  fusionCore.scale.setScalar((1.2 + Math.sin(elapsed * 9) * 0.2) * pulse)
}

const updateBurstParticles = (objects, delta, elapsed, phaseName, burstStartTime = 0) => {
  if (!objects.burstParticles) return
  if (phaseName !== 'burst') return fadeBurstParticles(objects.burstParticles)
  moveBurstParticles(objects, delta, elapsed, burstStartTime)
}

const moveBurstParticles = (objects, delta, elapsed, burstStartTime) => {
  const age = Math.max(0, elapsed - burstStartTime)
  const positionAttribute = objects.burstParticles.geometry.getAttribute('position')
  const positions = positionAttribute.array
  objects.burstParticleData.forEach((particle, index) => updateParticlePosition(positions, particle, index, age))
  positionAttribute.needsUpdate = true
  objects.burstParticles.visible = true
  objects.burstParticles.rotation.z += delta * 0.48
  objects.burstParticles.material.opacity = age < 0.06 ? age / 0.06 : Math.max(0, 1 - Math.max(0, age - 0.36) / 0.14)
}

const updateParticlePosition = (positions, particle, index, age) => {
  const localAge = Math.max(0, age - particle.delay)
  const progress = easeOutExpo(Math.min(localAge / 0.38, 1))
  const distance = particle.spread * progress
  positions[index * 3] = particle.direction.x * distance
  positions[index * 3 + 1] = particle.direction.y * distance - localAge * localAge * 0.28
  positions[index * 3 + 2] = particle.direction.z * distance
}

const fadeBurstParticles = (burstParticles) => {
  burstParticles.material.opacity += (0 - burstParticles.material.opacity) * 0.12
  if (burstParticles.material.opacity < 0.01) burstParticles.visible = false
}

const updateCamera = (camera, phaseName) => {
  const targetZ = phaseName === 'burst' ? 8.4 : phaseName === 'fusion' ? 7.8 : phaseName === 'drawing' ? 9.2 : 10.4
  camera.position.z += (targetZ - camera.position.z) * 0.045
  camera.position.y += ((phaseName === 'fusion' || phaseName === 'burst' ? 0.08 : 0.4) - camera.position.y) * 0.035
  camera.lookAt(0, 0, 0)
}

const getLabelDepthMode = (mesh, frontFactor) => {
  const previousDepthMode = mesh.userData.depthMode ?? 'sharp'
  if (frontFactor > 0.58) return 'sharp'
  if (frontFactor < 0.32) return 'blurred'
  return previousDepthMode
}

const getRingSpeedMultiplier = (phaseName) => {
  if (phaseName === 'drawing') return 4.8
  if (phaseName === 'burst') return 7.5
  if (phaseName === 'fusion') return 6
  return 1.5
}

const getRingOpacity = (phaseName) => {
  if (phaseName === 'empty') return 0.48
  if (phaseName === 'burst') return 0.86
  if (phaseName === 'fusion') return 0.72
  return 0.38
}

const getTunnelSpeed = (phaseName) => {
  if (phaseName === 'burst') return 0.032
  if (phaseName === 'fusion') return 0.026
  if (phaseName === 'drawing') return 0.018
  return 0.004
}

const getTunnelOpacity = (phaseName) => {
  if (phaseName === 'burst') return 0.42
  if (phaseName === 'fusion') return 0.34
  if (phaseName === 'drawing') return 0.24
  return 0.1
}

const easeOutExpo = (value) => {
  if (value >= 1) return 1
  return 1 - Math.pow(2, -10 * value)
}
