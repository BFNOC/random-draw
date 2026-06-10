let prizeItemSeed = 0

export const createPrizeItem = (overrides = {}) => ({
  id: overrides.id || `prize-${Date.now()}-${prizeItemSeed += 1}`,
  name: overrides.name ?? '',
  drawSize: toPositiveInteger(overrides.drawSize, 1),
  drawTimes: toPositiveInteger(overrides.drawTimes, 1)
})

export const createDefaultPrizeItems = () => [
  createPrizeItem({ name: '', drawSize: 1, drawTimes: 1 })
]

export const buildPrizeDrawPlan = (items) => {
  const plan = []
  getValidPrizeItems(items).forEach((item, prizeIndex) => {
    for (let index = 1; index <= item.drawTimes; index += 1) {
      plan.push({
        globalBatch: plan.length + 1,
        prizeId: item.id,
        prizeIndex,
        prizeName: item.name,
        drawSize: item.drawSize,
        roundIndex: index,
        totalRounds: item.drawTimes
      })
    }
  })

  return plan
}

export const getValidPrizeItems = (items) => {
  return items
    .map(normalizePrizeItem)
    .filter(item => item.name !== '' && item.drawSize > 0 && item.drawTimes > 0)
}

export const getPrizePlanWinnerCount = (items) => {
  return getValidPrizeItems(items).reduce((total, item) => total + item.drawSize * item.drawTimes, 0)
}

export const getCurrentPrizeDraw = (plan, currentBatch) => {
  if (currentBatch < 1) return null
  return plan[currentBatch - 1] || null
}

export const getPrizeDrawTitle = (draw) => {
  if (!draw) return '未配置奖项'
  return `${draw.prizeName} 第 ${draw.roundIndex}/${draw.totalRounds} 次`
}

export const normalizePrizeItem = (item) => ({
  id: item.id || `prize-${Date.now()}-${prizeItemSeed += 1}`,
  name: String(item.name || '').trim(),
  drawSize: toPositiveInteger(item.drawSize, 0),
  drawTimes: toPositiveInteger(item.drawTimes, 0)
})

const toPositiveInteger = (value, fallback) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return fallback
  return Math.max(0, Math.floor(numberValue))
}
