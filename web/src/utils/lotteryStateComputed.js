import { computed } from 'vue'
import { getRemainingNames, parseNameList } from './nameList'
import { buildPrizeDrawPlan, getCurrentPrizeDraw, getPrizePlanWinnerCount, getValidPrizeItems } from './prizePlan'

export const createLotteryComputed = (state) => {
  const nameList = computed(() => parseNameList(state.nameInput.value))
  const remainingCount = computed(() => Math.max(0, nameList.value.length - state.allPickedNames.value.length))
  const prizeDrawPlan = computed(() => buildPrizeDrawPlan(state.prizeItems.value))
  const currentPrizeDraw = computed(() => getCurrentPrizeDraw(prizeDrawPlan.value, state.currentBatch.value))
  const completedPrizeDraw = computed(() => getCompletedPrizeDraw(state))
  const stagePrizeDraw = computed(() => getStagePrizeDraw(state, currentPrizeDraw.value, completedPrizeDraw.value))
  const totalBatches = computed(() => prizeDrawPlan.value.length)
  const validPrizeCount = computed(() => getValidPrizeItems(state.prizeItems.value).length)
  const isThreeStage = computed(() => state.stageMode.value === 'three')
  const canStartDraw = createCanStartDraw(state, nameList, remainingCount, currentPrizeDraw)
  const readinessStatus = createReadinessStatus(state, nameList, remainingCount, currentPrizeDraw, totalBatches)
  const showDroppingResult = computed(() => {
    return isThreeStage.value && state.isDroppingPreviousResult.value && state.droppingResultNames.value.length > 0
  })

  return {
    batchSize: computed(() => currentPrizeDraw.value?.drawSize || 0),
    canStartDraw,
    completedBatchCount: computed(() => Math.min(Math.max(0, state.currentBatch.value - 1), totalBatches.value)),
    completedPrizeDraw,
    currentPrizeDraw,
    isThreeStage,
    nameList,
    plannedWinnerCount: computed(() => getPrizePlanWinnerCount(state.prizeItems.value)),
    prizeDrawPlan,
    readinessStatus,
    remainingCount,
    remainingNamesForStage: computed(() => getRemainingNames(nameList.value, state.allPickedNames.value)),
    setupSteps: createSetupSteps(state, nameList, canStartDraw, readinessStatus, validPrizeCount, totalBatches),
    showDroppingResult,
    stagePrizeDraw,
    showThreeStaticResult: createShowThreeStaticResult(state, isThreeStage),
    threeResultNames: computed(() => showDroppingResult.value ? state.droppingResultNames.value : state.pickedNames.value),
    totalBatches,
    validPrizeCount
  }
}

const createCanStartDraw = (state, nameList, remainingCount, currentPrizeDraw) => {
  return computed(() => {
    return Boolean(nameList.value.length > 0
      && currentPrizeDraw.value
      && currentPrizeDraw.value.drawSize > 0
      && currentPrizeDraw.value.drawSize <= remainingCount.value
      && remainingCount.value > 0
      && !state.isDrawing.value)
  })
}

const createReadinessStatus = (state, nameList, remainingCount, currentPrizeDraw, totalBatches) => {
  return computed(() => {
    if (nameList.value.length === 0) return '先导入名单'
    if (totalBatches.value === 0) return '配置奖项'
    if (remainingCount.value === 0) return '名单已抽完'
    if (!currentPrizeDraw.value) return '奖项已完成'
    if (currentPrizeDraw.value.drawSize > remainingCount.value) return '奖池不足'
    return '可以开始'
  })
}

const createSetupSteps = (state, nameList, canStartDraw, readinessStatus, validPrizeCount, totalBatches) => {
  return computed(() => [
    getSetupStep('导入名单', nameList.value.length > 0 ? `${nameList.value.length} 人已进入奖池` : '粘贴名单或选择 TXT 文件', nameList.value.length > 0),
    getSetupStep('配置奖项', totalBatches.value > 0 ? `${validPrizeCount.value} 个奖项，共 ${totalBatches.value} 次` : '添加奖项名称、人数和次数', totalBatches.value > 0),
    getSetupStep('开始抽签', canStartDraw.value ? '准备完成' : readinessStatus.value, canStartDraw.value)
  ])
}

const createShowThreeStaticResult = (state, isThreeStage) => {
  return computed(() => {
    return isThreeStage.value
      && state.pickedNames.value.length > 0
      && !state.isDrawing.value
      && !state.isDroppingPreviousResult.value
      && !state.isThreeFinalBurst.value
  })
}

const getSetupStep = (label, detail, done) => ({ label, detail, done })

const getCompletedPrizeDraw = (state) => {
  const record = state.historyRecords.value[0]
  if (!record) return null

  return {
    globalBatch: record.batch,
    prizeId: record.prizeId,
    prizeName: record.prizeName,
    drawSize: record.drawSize,
    roundIndex: record.roundIndex,
    totalRounds: record.totalRounds
  }
}

const getStagePrizeDraw = (state, currentPrizeDraw, completedPrizeDraw) => {
  if (state.isThreeFinalBurst.value) return completedPrizeDraw || currentPrizeDraw
  if (state.isDrawing.value || state.pickedNames.value.length === 0) return currentPrizeDraw
  return completedPrizeDraw || currentPrizeDraw
}
