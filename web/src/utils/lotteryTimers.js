export const createLotteryTimers = () => ({
  drawing: null,
  droppingResult: null,
  reveal: null,
  threeFinalBurst: null
})

export const clearDrawingTimers = (timers) => {
  if (timers.drawing) window.clearInterval(timers.drawing)
  if (timers.reveal) window.clearInterval(timers.reveal)
  timers.drawing = null
  timers.reveal = null
}

export const clearThreeTimers = (timers) => {
  if (timers.droppingResult) window.clearTimeout(timers.droppingResult)
  if (timers.threeFinalBurst) window.clearTimeout(timers.threeFinalBurst)
  timers.droppingResult = null
  timers.threeFinalBurst = null
}
