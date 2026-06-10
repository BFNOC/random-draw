import { ElMessage, ElMessageBox } from 'element-plus'
import confetti from 'canvas-confetti'
import {
  CONFETTI_COLORS,
  DRAWING_ROLL_INTERVAL_MS,
  REVEAL_INTERVAL_MS,
  REVEAL_TARGET_STEPS,
  THREE_FINAL_BURST_MS,
  THREE_RESULT_DROP_MS
} from '../constants/lottery'
import { downloadTextFile } from './downloadText'
import { pickRandomUniqueNames, shuffleNames } from './nameList'
import { clearDrawingTimers, clearThreeTimers } from './lotteryTimers'
import { getPrizeDrawTitle } from './prizePlan'

export const setStageMode = (state, mode) => {
  state.stageMode.value = mode
}

export const startDraw = (context) => {
  const remainingNames = context.state.remainingNamesForStage.value
  if (!validateStartDraw(context.state, remainingNames)) return

  context.sound.prepareResultSound()
  resetThreeBurstTimer(context)
  schedulePreviousResultDrop(context)
  context.state.isDrawing.value = true
  context.state.isRevealing.value = false
  context.state.revealedCount.value = 0
  clearDrawingTimers(context.timers)
  context.timers.drawing = window.setInterval(() => {
    context.state.pickedNames.value = pickRandomUniqueNames(remainingNames, context.state.currentPrizeDraw.value.drawSize)
  }, DRAWING_ROLL_INTERVAL_MS)
}

export const stopDraw = (context) => {
  if (!context.state.isDrawing.value || context.state.isRevealing.value) return

  context.sound.prepareResultSound()
  context.state.isRevealing.value = true
  if (context.timers.drawing) window.clearInterval(context.timers.drawing)

  const finalNames = buildFinalNames(context.state)
  context.state.revealedCount.value = 0
  context.timers.reveal = window.setInterval(() => {
    revealNextFrame(context, finalNames)
  }, REVEAL_INTERVAL_MS)
}

export const clearResult = (context) => {
  context.state.pickedNames.value = []
  context.state.allPickedNames.value = []
  context.state.currentBatch.value = 1
  context.state.historyRecords.value = []
  context.state.revealedCount.value = 0
  context.state.isDrawing.value = false
  context.state.isRevealing.value = false
  context.state.isDroppingPreviousResult.value = false
  context.state.isThreeFinalBurst.value = false
  context.state.droppingResultNames.value = []
  clearDrawingTimers(context.timers)
  clearThreeTimers(context.timers)
  ElMessage.success('数据重置成功')
}

export const handleResetConfirm = (context) => {
  ElMessageBox.confirm(
    '确定要重置中奖结果和历史记录吗？名单与奖项设置会保留，此操作不可撤销。',
    '重置二次确认',
    { confirmButtonText: '确定重置', cancelButtonText: '取消', type: 'warning', buttonSize: 'default', boxType: 'confirm', center: true }
  ).then(() => clearResult(context)).catch(() => {})
}

export const clearInput = (context) => {
  context.state.nameInput.value = ''
  clearResult(context)
}

export const exportHistory = (state) => {
  if (state.historyRecords.value.length === 0) {
    ElMessage.warning('暂无可以导出的历史记录')
    return
  }

  const content = [...state.historyRecords.value].reverse().map(record => {
    return [
      `第 ${record.batch} 次：${record.prizeName}（第 ${record.roundIndex}/${record.totalRounds} 次，抽取 ${record.names.length} 人）`,
      record.names.join('\n')
    ].join('\n')
  }).join('\n\n')

  downloadTextFile(content, '抽奖结果.txt')
  ElMessage.success('抽奖结果导出成功')
}

export const validateStartDraw = (state, remainingNames) => {
  if (state.nameList.value.length === 0) return showStartWarning('请先导入或输入名单')
  if (state.totalBatches.value === 0) return showStartWarning('请先添加至少一个有效奖项')
  if (remainingNames.length === 0) return showStartWarning('所有人员已被抽取完毕')
  if (!state.currentPrizeDraw.value) {
    return showStartWarning('所有奖项已抽取完成，请重置后再开始')
  }
  if (state.currentPrizeDraw.value.drawSize <= 0) return showStartWarning('本次抽取人数必须大于 0')
  if (state.currentPrizeDraw.value.drawSize > remainingNames.length) {
    return showStartWarning(`${getPrizeDrawTitle(state.currentPrizeDraw.value)} 需要 ${state.currentPrizeDraw.value.drawSize} 人，当前剩余 ${remainingNames.length} 人`)
  }

  return true
}

export const schedulePreviousResultDrop = (context) => {
  const { state, timers } = context
  if (!state.isThreeStage.value || state.pickedNames.value.length === 0 || state.isDrawing.value) return

  state.droppingResultNames.value = [...state.pickedNames.value]
  state.isDroppingPreviousResult.value = true
  if (timers.droppingResult) window.clearTimeout(timers.droppingResult)
  timers.droppingResult = window.setTimeout(() => {
    state.isDroppingPreviousResult.value = false
    state.droppingResultNames.value = []
    timers.droppingResult = null
  }, THREE_RESULT_DROP_MS)
}

export const buildFinalNames = (state) => {
  const namesCopy = shuffleNames(state.remainingNamesForStage.value)
  return namesCopy.slice(0, Math.min(state.currentPrizeDraw.value.drawSize, namesCopy.length))
}

export const revealNextFrame = (context, finalNames) => {
  const step = Math.max(1, Math.ceil(finalNames.length / REVEAL_TARGET_STEPS))
  context.state.revealedCount.value += step

  if (context.state.revealedCount.value >= finalNames.length) {
    window.clearInterval(context.timers.reveal)
    context.timers.reveal = null
    finishDrawReveal(context, finalNames)
    return
  }

  context.state.pickedNames.value = buildRevealFrame(context.state, finalNames)
}

export const buildRevealFrame = (state, finalNames) => {
  const usedFinalNames = finalNames.slice(0, state.revealedCount.value)
  const rollPool = state.remainingNamesForStage.value.filter(name => !usedFinalNames.includes(name))

  return finalNames.map((name, index) => {
    if (index < state.revealedCount.value) return name
    if (rollPool.length === 0) return '...'
    return rollPool.splice(Math.floor(Math.random() * rollPool.length), 1)[0]
  })
}

export const finishDrawReveal = (context, finalNames) => {
  const { state, timers } = context
  const completedPrizeDraw = state.currentPrizeDraw.value
  state.pickedNames.value = [...finalNames]
  state.allPickedNames.value = [...state.allPickedNames.value, ...finalNames]
  state.historyRecords.value.unshift({
    batch: state.currentBatch.value,
    prizeId: completedPrizeDraw.prizeId,
    prizeName: completedPrizeDraw.prizeName,
    roundIndex: completedPrizeDraw.roundIndex,
    totalRounds: completedPrizeDraw.totalRounds,
    drawSize: completedPrizeDraw.drawSize,
    names: finalNames
  })
  state.currentBatch.value += 1

  if (!state.isThreeStage.value) {
    finishDrawFeedback(context, finalNames, completedPrizeDraw)
    return
  }

  state.isThreeFinalBurst.value = true
  if (timers.threeFinalBurst) window.clearTimeout(timers.threeFinalBurst)
  timers.threeFinalBurst = window.setTimeout(() => finishDrawFeedback(context, finalNames, completedPrizeDraw), THREE_FINAL_BURST_MS)
}

export const finishDrawFeedback = (context, finalNames, completedPrizeDraw) => {
  context.state.isDrawing.value = false
  context.state.isRevealing.value = false
  context.state.isThreeFinalBurst.value = false
  context.timers.threeFinalBurst = null
  ElMessage.success(`${getPrizeDrawTitle(completedPrizeDraw)} 抽取完成，成功抽取 ${finalNames.length} 人`)
  context.sound.playDrawCompleteSound()
  triggerConfetti()
}

export const triggerConfetti = () => {
  const count = 300
  const defaults = { origin: { y: 0.65 }, colors: CONFETTI_COLORS }
  const fire = (particleRatio, opts) => {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) })
  }

  fire(0.25, { spread: 26, startVelocity: 55 })
  fire(0.2, { spread: 60 })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  fire(0.1, { spread: 120, startVelocity: 45 })
}

export const resetThreeBurstTimer = ({ state, timers }) => {
  if (timers.threeFinalBurst) {
    window.clearTimeout(timers.threeFinalBurst)
    timers.threeFinalBurst = null
  }
  state.isThreeFinalBurst.value = false
}

const showStartWarning = (message) => {
  ElMessage.warning(message)
  return false
}
