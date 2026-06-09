import * as THREE from 'three'

export const getSpherePosition = (index, count) => {
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

export const getCenterBurstPosition = (index) => {
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

export const getBurstTargetPosition = (index, count, stageSize) => {
  const columns = Math.min(9, Math.max(3, Math.ceil(Math.sqrt(Math.max(count, 1)) * 1.35)))
  const rows = Math.ceil(Math.max(count, 1) / columns)
  const column = index % columns
  const row = Math.floor(index / columns)
  const aspect = stageSize.width > 0 && stageSize.height > 0 ? stageSize.width / stageSize.height : 16 / 9
  const horizontalSpan = Math.min(8.8, 5.2 * aspect)
  const verticalSpan = 4.35
  const xRatio = columns === 1 ? 0 : column / (columns - 1) - 0.5
  const yRatio = rows === 1 ? 0 : 0.5 - row / (rows - 1)

  return new THREE.Vector3(
    xRatio * horizontalSpan + (Math.random() - 0.5) * 0.34,
    yRatio * verticalSpan + (Math.random() - 0.5) * 0.26,
    2.05 + (index % 4) * 0.18 + Math.random() * 0.46
  )
}
