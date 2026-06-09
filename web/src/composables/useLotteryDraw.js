import { onUnmounted } from 'vue'
import { useLotteryState } from './useLotteryState'
import {
  adjustPickCount,
  clearInput,
  exportHistory,
  handleResetConfirm,
  setStageMode,
  startDraw,
  stopDraw
} from '../utils/lotteryActions'
import { clearDrawingTimers, clearThreeTimers, createLotteryTimers } from '../utils/lotteryTimers'

export const useLotteryDraw = ({ prepareResultSound, playDrawCompleteSound }) => {
  const state = useLotteryState()
  const timers = createLotteryTimers()
  const context = {
    sound: { prepareResultSound, playDrawCompleteSound },
    state,
    timers
  }

  onUnmounted(() => {
    clearDrawingTimers(timers)
    clearThreeTimers(timers)
  })

  return {
    ...state,
    adjustPickCount: () => adjustPickCount(state),
    clearInput: () => clearInput(context),
    exportHistory: () => exportHistory(state),
    handleResetConfirm: () => handleResetConfirm(context),
    setStageMode: mode => setStageMode(state, mode),
    startDraw: () => startDraw(context),
    stopDraw: () => stopDraw(context)
  }
}
