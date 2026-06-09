import { onMounted, onUnmounted } from 'vue'

export const useLotteryKeyboard = ({ isDrawing, startDraw, stopDraw }) => {
  const isTypingTarget = (element) => {
    return element?.tagName === 'INPUT' || element?.tagName === 'TEXTAREA'
  }

  const handleKeyDown = (event) => {
    if (event.key !== ' ' && event.code !== 'Space') return
    if (isTypingTarget(document.activeElement)) return

    event.preventDefault()
    if (isDrawing.value) stopDraw()
    else startDraw()
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
