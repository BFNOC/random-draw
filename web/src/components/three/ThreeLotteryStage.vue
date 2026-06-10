<script setup>
import { computed } from 'vue'
import { useThreeLotteryStage } from '../../composables/useThreeLotteryStage'
import '../../styles/three-lottery-stage.css'

const props = defineProps({
  isBursting: {
    type: Boolean,
    default: false
  },
  isDrawing: {
    type: Boolean,
    default: false
  },
  isRevealing: {
    type: Boolean,
    default: false
  },
  names: {
    type: Array,
    default: () => []
  },
  poolNames: {
    type: Array,
    default: () => []
  },
  prizeDraw: {
    type: Object,
    default: null
  },
  revealedCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['import-list'])
const { canvasRef, phase, stageRef, webglUnavailable } = useThreeLotteryStage(props)

const phaseLabel = computed(() => {
  if (phase.value === 'empty') return '3D 舞台'
  if (phase.value === 'intake') return '名单入场'
  if (phase.value === 'drawing') return '高速抽取'
  if (phase.value === 'fusion') return '结果聚合'
  if (phase.value === 'burst') return '结果展开'
  if (phase.value === 'clearing') return '下一轮准备'
  return '本轮结果'
})
</script>

<template>
  <section
    ref="stageRef"
    class="three-stage"
    :class="`phase-${phase}`"
    aria-label="3D 抽签舞台"
  >
    <canvas v-show="!webglUnavailable" ref="canvasRef" class="three-canvas"></canvas>
    <div class="stage-lattice" aria-hidden="true"></div>
    <div class="stage-flare flare-left" aria-hidden="true"></div>
    <div class="stage-flare flare-right" aria-hidden="true"></div>
    <div class="stage-vortex" aria-hidden="true"></div>

    <div class="three-stage-topline">
      <span>{{ prizeDraw ? prizeDraw.prizeName : phaseLabel }}</span>
      <strong v-if="prizeDraw">第 {{ prizeDraw.roundIndex }}/{{ prizeDraw.totalRounds }} 次 · {{ prizeDraw.drawSize }} 人</strong>
      <strong v-else>{{ names.length || poolNames.length }} 人</strong>
    </div>

    <div v-if="webglUnavailable" class="three-fallback">
      当前浏览器无法启动 WebGL，已保留结果展示。
    </div>

    <button v-if="phase === 'empty'" type="button" class="stage-load-button" @click="emit('import-list')">
      导入名单
    </button>
  </section>
</template>
