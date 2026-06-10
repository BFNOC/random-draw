import { ref } from 'vue'
import { createLotteryComputed } from '../utils/lotteryStateComputed'
import { createDefaultPrizeItems } from '../utils/prizePlan'

export const useLotteryState = () => {
  const baseState = createBaseLotteryState()
  return {
    ...baseState,
    ...createLotteryComputed(baseState)
  }
}

const createBaseLotteryState = () => ({
  allPickedNames: ref([]),
  currentBatch: ref(1),
  droppingResultNames: ref([]),
  historyRecords: ref([]),
  isDrawing: ref(false),
  isDroppingPreviousResult: ref(false),
  isRevealing: ref(false),
  isThreeFinalBurst: ref(false),
  nameInput: ref(''),
  pickedNames: ref([]),
  prizeItems: ref(createDefaultPrizeItems()),
  revealedCount: ref(0),
  stageMode: ref('grid')
})
