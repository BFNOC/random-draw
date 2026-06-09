import * as THREE from 'three'
import { createLabelTexture } from './threeLotteryLabels'
import { getBurstTargetPosition, getCenterBurstPosition, getSpherePosition } from './threeLotteryPositions'

export const createThreeLotteryDeck = ({ stageSize }) => {
  const labelGroup = new THREE.Group()
  const labelWorldPosition = new THREE.Vector3()
  let cards = []
  let lastDeckKey = ''

  const dispose = (resetKey = true) => {
    cards.forEach(({ mesh, material, sharpTexture, blurTexture }) => {
      labelGroup.remove(mesh)
      sharpTexture.dispose()
      if (blurTexture !== sharpTexture) blurTexture.dispose()
      material.dispose()
    })
    cards = []
    if (resetKey) lastDeckKey = ''
  }

  const rebuild = (names, mode) => {
    const deckKey = `${mode}:${names.join('|')}`
    if (deckKey === lastDeckKey) return
    lastDeckKey = deckKey
    dispose(false)
    names.forEach((name, index) => {
      cards.push(createLabelCard(name, index, names.length, mode, stageSize.value, labelGroup))
    })
  }

  const refresh = (names, mode) => {
    if (cards.length === 0 || cards.length !== names.length) {
      rebuild(names, mode)
      return
    }

    const nextKey = `${mode}:${names.join('|')}`
    if (nextKey === lastDeckKey) return
    lastDeckKey = nextKey
    names.forEach((name, index) => refreshCardTexture(cards[index], name, mode, index, false))
  }

  const refreshBack = (names, mode) => {
    if (cards.length === 0 || cards.length !== names.length) {
      rebuild(names, mode)
      return
    }

    const nextKey = `${mode}:${names.join('|')}`
    if (nextKey === lastDeckKey) return
    lastDeckKey = nextKey
    getBackCards(cards, labelWorldPosition).forEach(({ card, index }) => {
      if (names[index]) refreshCardTexture(card, names[index], mode, index, true)
    })
  }

  return {
    dispose,
    get cards() {
      return cards
    },
    labelGroup,
    labelWorldPosition,
    rebuild,
    refresh,
    refreshBack
  }
}

const createLabelCard = (name, index, total, mode, stageSize, labelGroup) => {
  const sharpTexture = createLabelTexture(name, mode, index, 'sharp')
  const blurTexture = mode === 'orbit' ? createLabelTexture(name, mode, index, 'blurred') : sharpTexture
  const material = createLabelMaterial(sharpTexture, mode)
  const mesh = new THREE.Sprite(material)
  const centerPoint = createCenterPoint()
  const target = mode === 'burst' ? getBurstTargetPosition(index, total, stageSize) : getSpherePosition(index, total)
  const start = getStartPosition(mode, centerPoint, target, index)

  mesh.position.copy(start)
  mesh.scale.set(1.5, 0.56, 1)
  mesh.userData = createLabelUserData(index, mode, start, centerPoint, target)
  labelGroup.add(mesh)
  return { mesh, material, sharpTexture, blurTexture }
}

const createLabelMaterial = (texture, mode) => {
  return new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: mode === 'intake' ? 0.28 : mode === 'burst' ? 0 : mode === 'drawing' ? 0.72 : 0.88,
    blending: mode === 'drawing' || mode === 'fusion' || mode === 'burst' ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false
  })
}

const createCenterPoint = () => {
  return new THREE.Vector3(
    (Math.random() - 0.5) * 0.42,
    (Math.random() - 0.5) * 0.26,
    -0.28 + Math.random() * 0.32
  )
}

const getStartPosition = (mode, centerPoint, target, index) => {
  if (mode === 'intake') return getCenterBurstPosition(index)
  if (mode === 'burst') return centerPoint.clone()
  return target.clone()
}

const createLabelUserData = (index, mode, start, centerPoint, target) => ({
  age: 0,
  centerPoint,
  depthMode: 'sharp',
  fusionTarget: new THREE.Vector3(
    (Math.random() - 0.5) * 0.92,
    (Math.random() - 0.5) * 0.64,
    (Math.random() - 0.5) * 0.82
  ),
  index,
  mode,
  nameFade: 1,
  seed: Math.random() * 100,
  start,
  target
})

const refreshCardTexture = (card, name, mode, index, forceBlurred) => {
  if (!card) return

  const nextSharpTexture = createLabelTexture(name, mode, index, 'sharp')
  const nextBlurTexture = mode === 'orbit' ? createLabelTexture(name, mode, index, 'blurred') : nextSharpTexture
  card.sharpTexture.dispose()
  if (card.blurTexture !== card.sharpTexture) card.blurTexture.dispose()
  card.sharpTexture = nextSharpTexture
  card.blurTexture = nextBlurTexture
  card.material.map = forceBlurred || card.mesh.userData.depthMode === 'blurred' ? nextBlurTexture : nextSharpTexture
  card.material.needsUpdate = true
  card.material.opacity = forceBlurred ? card.material.opacity : 0.2
  card.mesh.userData.depthMode = forceBlurred ? 'blurred' : card.mesh.userData.depthMode
  card.mesh.userData.nameFade = forceBlurred ? Math.max(0.72, card.mesh.userData.nameFade ?? 1) : 0
}

const getBackCards = (cards, labelWorldPosition) => {
  return cards
    .map((card, index) => {
      card.mesh.getWorldPosition(labelWorldPosition)
      return { card, index, z: labelWorldPosition.z }
    })
    .sort((a, b) => a.z - b.z)
    .slice(0, 4)
}
