<script setup>
import ThreeLotteryStage from '../three/ThreeLotteryStage.vue'
import NameResultGrid from './NameResultGrid.vue'
import PrizeResultBanner from './PrizeResultBanner.vue'
import StandbyPanel from './StandbyPanel.vue'

defineProps({
  batchSize: {
    type: Number,
    required: true
  },
  canStartDraw: {
    type: Boolean,
    required: true
  },
  completedPrizeDraw: {
    type: Object,
    default: null
  },
  completedBatchCount: {
    type: Number,
    required: true
  },
  currentPrizeDraw: {
    type: Object,
    default: null
  },
  getNameStyle: {
    type: Function,
    required: true
  },
  gridStyle: {
    type: Object,
    default: () => ({})
  },
  isDrawing: {
    type: Boolean,
    required: true
  },
  isRevealing: {
    type: Boolean,
    required: true
  },
  isThreeFinalBurst: {
    type: Boolean,
    required: true
  },
  isThreeStage: {
    type: Boolean,
    required: true
  },
  nameCount: {
    type: Number,
    required: true
  },
  pickedNames: {
    type: Array,
    default: () => []
  },
  remainingCount: {
    type: Number,
    required: true
  },
  remainingNamesForStage: {
    type: Array,
    default: () => []
  },
  revealedCount: {
    type: Number,
    required: true
  },
  setupSteps: {
    type: Array,
    required: true
  },
  showDroppingResult: {
    type: Boolean,
    required: true
  },
  showThreeStaticResult: {
    type: Boolean,
    required: true
  },
  stagePrizeDraw: {
    type: Object,
    default: null
  },
  threeResultGridStyle: {
    type: Object,
    default: () => ({})
  },
  threeResultNames: {
    type: Array,
    default: () => []
  },
  totalBatches: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['import-list', 'open-drawer', 'start-draw'])
</script>

<template>
  <main class="grid-content-area">
    <div v-if="isThreeStage" class="grid-animation-wrapper is-three-stage">
      <ThreeLotteryStage
        v-if="!showThreeStaticResult"
        :names="pickedNames"
        :pool-names="remainingNamesForStage"
        :is-drawing="isDrawing"
        :is-revealing="isRevealing"
        :is-bursting="isThreeFinalBurst"
        :prize-draw="stagePrizeDraw"
        :revealed-count="revealedCount"
        @import-list="emit('import-list', 'three')"
      />
      <div
        v-if="showThreeStaticResult || showDroppingResult"
        class="three-original-result-layer has-prize-status"
        :class="{ 'is-dropping': showDroppingResult }"
      >
        <PrizeResultBanner
          :draw-info="showDroppingResult ? completedPrizeDraw : stagePrizeDraw"
          :label="showDroppingResult ? '上一轮结果' : '本轮结果'"
        />
        <NameResultGrid
          :names="threeResultNames"
          :grid-style="threeResultGridStyle"
          :get-name-style="getNameStyle"
          static-revealed
        />
      </div>
    </div>

    <template v-else>
      <StandbyPanel
        v-if="pickedNames.length === 0"
        :name-count="nameCount"
        :batch-size="batchSize"
        :current-prize-draw="currentPrizeDraw"
        :remaining-count="remainingCount"
        :completed-batch-count="completedBatchCount"
        :total-batches="totalBatches"
        :setup-steps="setupSteps"
        :can-start-draw="canStartDraw"
        @open-drawer="tab => emit('open-drawer', tab)"
        @start-draw="emit('start-draw')"
      />

      <div v-else class="grid-animation-wrapper has-prize-status">
        <PrizeResultBanner :draw-info="stagePrizeDraw" :label="isDrawing ? '正在抽取' : '本轮结果'" />
        <NameResultGrid
          :names="pickedNames"
          :grid-style="gridStyle"
          :is-drawing="isDrawing"
          :is-revealing="isRevealing"
          :revealed-count="revealedCount"
          :get-name-style="getNameStyle"
        />
      </div>
    </template>
  </main>
</template>
