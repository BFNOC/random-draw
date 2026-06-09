import { computed } from 'vue'
import { FALLBACK_MAX_PICK_COUNT } from '../constants/lottery'
import { getRemainingNames, parseNameList } from './nameList'

export const createLotteryComputed = (state) => {
  const nameList = computed(() => parseNameList(state.nameInput.value))
  const remainingCount = computed(() => Math.max(0, nameList.value.length - state.allPickedNames.value.length))
  const isThreeStage = computed(() => state.stageMode.value === 'three')
  const canStartDraw = createCanStartDraw(state, nameList, remainingCount)
  const readinessStatus = createReadinessStatus(state, nameList, remainingCount)
  const showDroppingResult = computed(() => {
    return isThreeStage.value && state.isDroppingPreviousResult.value && state.droppingResultNames.value.length > 0
  })

  return {
    canStartDraw,
    completedBatchCount: computed(() => Math.max(0, state.currentBatch.value - 1)),
    isThreeStage,
    maxPickCount: computed(() => Math.max(FALLBACK_MAX_PICK_COUNT, nameList.value.length, state.batchSize.value)),
    minPickCount: computed(() => 0),
    nameList,
    readinessStatus,
    remainingCount,
    remainingNamesForStage: computed(() => getRemainingNames(nameList.value, state.allPickedNames.value)),
    setupSteps: createSetupSteps(state, nameList, canStartDraw, readinessStatus),
    showDroppingResult,
    showThreeStaticResult: createShowThreeStaticResult(state, isThreeStage),
    threeResultNames: computed(() => showDroppingResult.value ? state.droppingResultNames.value : state.pickedNames.value)
  }
}

const createCanStartDraw = (state, nameList, remainingCount) => {
  return computed(() => {
    return nameList.value.length > 0
      && state.batchSize.value > 0
      && state.currentBatch.value <= state.totalBatches.value
      && remainingCount.value > 0
      && !state.isDrawing.value
  })
}

const createReadinessStatus = (state, nameList, remainingCount) => {
  return computed(() => {
    if (nameList.value.length === 0) return '先导入名单'
    if (state.batchSize.value <= 0) return '设置单批人数'
    if (remainingCount.value === 0) return '名单已抽完'
    if (state.currentBatch.value > state.totalBatches.value) return '轮数已完成'
    return '可以开始'
  })
}

const createSetupSteps = (state, nameList, canStartDraw, readinessStatus) => {
  return computed(() => [
    getSetupStep('导入名单', nameList.value.length > 0 ? `${nameList.value.length} 人已进入奖池` : '粘贴名单或选择 TXT 文件', nameList.value.length > 0),
    getSetupStep('确认人数', state.batchSize.value > 0 ? `每轮抽取 ${state.batchSize.value} 人` : '设置每轮抽取人数', state.batchSize.value > 0),
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
