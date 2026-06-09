<script setup>
import { computed } from 'vue'
import BottomControlBar from './lottery/BottomControlBar.vue'
import LotteryDrawer from './lottery/LotteryDrawer.vue'
import LotteryStageView from './lottery/LotteryStageView.vue'
import QuickSetupDialog from './lottery/QuickSetupDialog.vue'
import { useLotteryDraw } from '../composables/useLotteryDraw'
import { useLotteryKeyboard } from '../composables/useLotteryKeyboard'
import { useLotterySetup } from '../composables/useLotterySetup'
import { useResultSound } from '../composables/useResultSound'
import { getGridStyleByCount, getNameStyle } from '../utils/lotteryLayout'
import { appVersion } from '../version'
import '../styles/lottery.css'

const {
  audioFileInputRef,
  clearCustomResultSound,
  handleAudioFileImport,
  hasCustomResultSound,
  playDrawCompleteSound,
  prepareResultSound,
  previewResultSound,
  resultSoundLabel,
  triggerAudioFileSelect
} = useResultSound()

const lottery = useLotteryDraw({ prepareResultSound, playDrawCompleteSound })
const {
  adjustPickCount,
  allPickedNames,
  batchSize,
  canStartDraw,
  clearInput,
  completedBatchCount,
  currentBatch,
  exportHistory,
  handleResetConfirm,
  historyRecords,
  isDrawing,
  isRevealing,
  isThreeFinalBurst,
  isThreeStage,
  maxPickCount,
  minPickCount,
  nameInput,
  nameList,
  pickedNames,
  readinessStatus,
  remainingCount,
  remainingNamesForStage,
  revealedCount,
  setStageMode,
  setupSteps,
  showDroppingResult,
  showThreeStaticResult,
  stageMode,
  startDraw,
  stopDraw,
  threeResultNames,
  totalBatches
} = lottery

const {
  activeSettingsTab,
  confirmQuickSetup,
  drawerVisible,
  fileInputRef,
  handleFileImport,
  openDrawer,
  quickSetupBatchSize,
  quickSetupTotalBatches,
  quickSetupVisible,
  syncLocalizedAriaLabels,
  triggerFileSelect
} = useLotterySetup({
  adjustPickCount,
  batchSize,
  isThreeStage,
  nameInput,
  nameList,
  remainingCount,
  totalBatches
})

useLotteryKeyboard({ isDrawing, startDraw, stopDraw })

const currentYear = computed(() => new Date().getFullYear())
const gridStyle = computed(() => getGridStyleByCount(pickedNames.value.length))
const threeResultGridStyle = computed(() => getGridStyleByCount(threeResultNames.value.length))
</script>

<template>
  <div class="app-viewport">
    <input
      ref="fileInputRef"
      type="file"
      accept=".txt"
      aria-label="选择 TXT 名单文件"
      class="hidden-file-input"
      @change="handleFileImport"
    />
    <input
      ref="audioFileInputRef"
      type="file"
      accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
      aria-label="选择 MP3 或 WAV 结束音效文件"
      class="hidden-file-input"
      @change="handleAudioFileImport"
    />

    <div class="dynamic-background">
      <div class="ambient-glow glow-1"></div>
      <div class="ambient-glow glow-2"></div>
      <div class="ambient-glow glow-3"></div>
    </div>

    <div class="main-layout">
      <LotteryStageView
        :batch-size="batchSize"
        :can-start-draw="canStartDraw"
        :completed-batch-count="completedBatchCount"
        :get-name-style="getNameStyle"
        :grid-style="gridStyle"
        :is-drawing="isDrawing"
        :is-revealing="isRevealing"
        :is-three-final-burst="isThreeFinalBurst"
        :is-three-stage="isThreeStage"
        :name-count="nameList.length"
        :picked-names="pickedNames"
        :remaining-count="remainingCount"
        :remaining-names-for-stage="remainingNamesForStage"
        :revealed-count="revealedCount"
        :setup-steps="setupSteps"
        :show-dropping-result="showDroppingResult"
        :show-three-static-result="showThreeStaticResult"
        :three-result-grid-style="threeResultGridStyle"
        :three-result-names="threeResultNames"
        :total-batches="totalBatches"
        @import-list="triggerFileSelect"
        @open-drawer="openDrawer"
        @start-draw="startDraw"
      />

      <BottomControlBar
        :all-picked-count="allPickedNames.length"
        :app-version="appVersion"
        :batch-size="batchSize"
        :can-start-draw="canStartDraw"
        :current-batch="currentBatch"
        :current-year="currentYear"
        :is-drawing="isDrawing"
        :is-revealing="isRevealing"
        :name-count="nameList.length"
        :picked-count="pickedNames.length"
        :remaining-count="remainingCount"
        :stage-mode="stageMode"
        :total-batches="totalBatches"
        @open-drawer="openDrawer"
        @reset="handleResetConfirm"
        @set-stage-mode="setStageMode"
        @start-draw="startDraw"
        @stop-draw="stopDraw"
      />
    </div>

    <LotteryDrawer
      v-model:active-tab="activeSettingsTab"
      v-model:batch-size="batchSize"
      v-model:name-input="nameInput"
      v-model:total-batches="totalBatches"
      v-model:visible="drawerVisible"
      :all-picked-count="allPickedNames.length"
      :app-version="appVersion"
      :current-year="currentYear"
      :has-custom-result-sound="hasCustomResultSound"
      :history-records="historyRecords"
      :is-drawing="isDrawing"
      :max-pick-count="maxPickCount"
      :min-pick-count="minPickCount"
      :name-count="nameList.length"
      :readiness-status="readinessStatus"
      :remaining-count="remainingCount"
      :result-sound-label="resultSoundLabel"
      @clear-input="clearInput"
      @clear-sound="clearCustomResultSound"
      @export-history="exportHistory"
      @preview-sound="previewResultSound"
      @reset="handleResetConfirm"
      @sync-aria="syncLocalizedAriaLabels"
      @trigger-audio-file-select="triggerAudioFileSelect"
      @trigger-file-select="triggerFileSelect"
    />

    <QuickSetupDialog
      v-model:batch-size="quickSetupBatchSize"
      v-model:total-batches="quickSetupTotalBatches"
      v-model:visible="quickSetupVisible"
      :remaining-count="remainingCount"
      @confirm="confirmQuickSetup"
      @sync-aria="syncLocalizedAriaLabels"
    />
  </div>
</template>
