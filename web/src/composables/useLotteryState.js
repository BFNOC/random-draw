import { ref } from 'vue'
import { DEFAULT_BATCH_SIZE, DEFAULT_TOTAL_BATCHES } from '../constants/lottery'
import { createLotteryComputed } from '../utils/lotteryStateComputed'

export const useLotteryState = () => {
  const baseState = createBaseLotteryState()
  return {
    ...baseState,
    ...createLotteryComputed(baseState)
  }
}

const createBaseLotteryState = () => ({
  allPickedNames: ref([]),
  batchSize: ref(DEFAULT_BATCH_SIZE),
  currentBatch: ref(1),
  droppingResultNames: ref([]),
  historyRecords: ref([]),
  isDrawing: ref(false),
  isDroppingPreviousResult: ref(false),
  isRevealing: ref(false),
  isThreeFinalBurst: ref(false),
  nameInput: ref(''),
  pickedNames: ref([]),
  revealedCount: ref(0),
  stageMode: ref('grid'),
  totalBatches: ref(DEFAULT_TOTAL_BATCHES)
})
