import * as THREE from 'three'

export const createLabelTexture = (name, mode, index, variant = 'sharp') => {
  const texture = new THREE.CanvasTexture(makeLabelCanvas(name, mode, index, variant))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

const makeLabelCanvas = (name, mode, index, variant = 'sharp') => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const width = 384
  const height = 146

  canvas.width = width
  canvas.height = height
  if (!context) return canvas

  drawLabelFrame(context, width, height, mode, index)
  if (isAnonymousMode(mode)) {
    drawAnonymousLines(context)
    return canvas
  }

  drawLabelName(context, width, height, name, mode, variant)
  return canvas
}

const drawLabelFrame = (context, width, height, mode, index) => {
  const hue = (index * 29) % 360
  const isAnonymous = isAnonymousMode(mode)
  const isResult = mode === 'result'
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
  drawLabelBar(context, width, isAnonymous)
}

const drawLabelBar = (context, width, isAnonymous) => {
  const gradient = context.createLinearGradient(28, 28, width - 28, 28)
  gradient.addColorStop(0, isAnonymous ? 'rgba(255, 255, 255, 0.95)' : 'rgba(110, 206, 188, 0.22)')
  gradient.addColorStop(1, isAnonymous ? 'rgba(255, 196, 64, 0.16)' : 'rgba(255, 255, 255, 0.12)')
  context.fillStyle = gradient
  roundRect(context, 28, 28, width - 56, 16, 8)
  context.fill()
}

const drawAnonymousLines = (context) => {
  context.globalAlpha = 0.8
  for (let i = 0; i < 5; i += 1) {
    const y = 60 + i * 11
    const lineWidth = 82 + Math.random() * 160
    context.fillStyle = `rgba(255, 255, 255, ${0.16 + i * 0.06})`
    roundRect(context, 64 + Math.random() * 80, y, lineWidth, 8, 4)
    context.fill()
  }
  context.globalAlpha = 1
}

const drawLabelName = (context, width, height, name, mode, variant) => {
  const displayName = name.length > 8 ? `${name.slice(0, 8)}...` : name
  const fontSize = displayName.length >= 5 ? 42 : displayName.length >= 4 ? 48 : 56

  context.font = `900 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = getLabelTextColor(mode, variant)
  context.shadowColor = mode === 'result' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(93, 176, 218, 0.55)'
  context.shadowBlur = variant === 'blurred' ? 26 : mode === 'orbit' ? 8 : 4
  if (variant === 'blurred') context.filter = 'blur(3.2px)'
  context.fillText(displayName, width / 2, height / 2 + 12)
  context.filter = 'none'
}

const getLabelTextColor = (mode, variant) => {
  if (mode === 'result') return 'rgba(15, 64, 50, 0.98)'
  if (variant === 'blurred') return 'rgba(21, 45, 76, 0.24)'
  return 'rgba(21, 45, 76, 0.86)'
}

const isAnonymousMode = (mode) => mode === 'drawing' || mode === 'fusion' || mode === 'burst'

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
