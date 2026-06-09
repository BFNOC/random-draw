<script setup>
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
  revealedCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['import-list'])
const { canvasRef, phase, stageRef, webglUnavailable } = useThreeLotteryStage(props)
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
      <span v-if="phase === 'empty'">3D 舞台</span>
      <span v-else-if="phase === 'intake'">名单入场</span>
      <span v-else-if="phase === 'drawing'">高速抽取</span>
      <span v-else-if="phase === 'fusion'">结果聚合</span>
      <span v-else-if="phase === 'burst'">结果展开</span>
      <span v-else-if="phase === 'clearing'">下一轮准备</span>
      <span v-else>本轮结果</span>
      <strong>{{ names.length || poolNames.length }} 人</strong>
    </div>

    <div v-if="webglUnavailable" class="three-fallback">
      当前浏览器无法启动 WebGL，已保留结果展示。
    </div>

    <button v-if="phase === 'empty'" type="button" class="stage-load-button" @click="emit('import-list')">
      导入名单
    </button>
  </section>
</template>
