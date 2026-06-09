<script setup>
import { Refresh, Setting, VideoPause, VideoPlay } from '@element-plus/icons-vue'

defineProps({
  allPickedCount: {
    type: Number,
    required: true
  },
  appVersion: {
    type: String,
    required: true
  },
  batchSize: {
    type: Number,
    required: true
  },
  canStartDraw: {
    type: Boolean,
    required: true
  },
  currentBatch: {
    type: Number,
    required: true
  },
  currentYear: {
    type: Number,
    required: true
  },
  isDrawing: {
    type: Boolean,
    required: true
  },
  isRevealing: {
    type: Boolean,
    required: true
  },
  nameCount: {
    type: Number,
    required: true
  },
  pickedCount: {
    type: Number,
    required: true
  },
  remainingCount: {
    type: Number,
    required: true
  },
  stageMode: {
    type: String,
    required: true
  },
  totalBatches: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['open-drawer', 'reset', 'set-stage-mode', 'start-draw', 'stop-draw'])
</script>

<template>
  <footer class="app-bottom-bar">
    <div class="bottom-bar-left">
      <template v-if="!isDrawing">
        <div class="stage-switcher" role="group" aria-label="舞台视图切换">
          <button
            type="button"
            class="stage-switch-btn"
            :class="{ 'is-active': stageMode === 'grid' }"
            @click="emit('set-stage-mode', 'grid')"
          >
            普通
          </button>
          <button
            type="button"
            class="stage-switch-btn"
            :class="{ 'is-active': stageMode === 'three' }"
            @click="emit('set-stage-mode', 'three')"
          >
            3D
          </button>
        </div>

        <el-button class="icon-pill-btn" @click="emit('open-drawer', 'prepare')">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-button>

        <el-button
          type="primary"
          class="icon-pill-btn start-btn"
          :disabled="!canStartDraw"
          @click="emit('start-draw')"
        >
          <el-icon><VideoPlay /></el-icon>
          <span>开始</span>
        </el-button>

        <el-button
          class="icon-pill-btn danger"
          :disabled="pickedCount === 0 && allPickedCount === 0"
          @click="emit('reset')"
        >
          <el-icon><Refresh /></el-icon>
          <span>重置</span>
        </el-button>
      </template>

      <template v-else>
        <div class="stage-switcher is-disabled" role="group" aria-label="舞台视图切换">
          <button
            type="button"
            class="stage-switch-btn"
            :class="{ 'is-active': stageMode === 'grid' }"
            disabled
          >
            普通
          </button>
          <button
            type="button"
            class="stage-switch-btn"
            :class="{ 'is-active': stageMode === 'three' }"
            disabled
          >
            3D
          </button>
        </div>

        <el-button class="icon-pill-btn" disabled>
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-button>

        <el-button
          type="danger"
          class="icon-pill-btn stop-btn"
          :disabled="isRevealing"
          @click="emit('stop-draw')"
        >
          <el-icon class="pulse-icon"><VideoPause /></el-icon>
          <span>{{ isRevealing ? '正在揭晓...' : '停止' }}</span>
        </el-button>
      </template>
    </div>

    <div class="bottom-bar-center" :class="{ 'dimmed-info': isDrawing }">
      <div class="bottom-stats-container">
        <span class="stat-capsule">进度 <span class="stat-highlight">{{ currentBatch - 1 }} / {{ totalBatches }}</span> 轮</span>
        <span class="stat-divider">·</span>
        <span class="stat-capsule">单批 <span class="stat-highlight">{{ batchSize }}</span> 人</span>
        <span class="stat-divider">·</span>
        <span class="stat-capsule">奖池剩余 <span class="stat-highlight">{{ remainingCount }} / {{ nameCount }}</span> 人</span>
      </div>
    </div>

    <div class="bottom-bar-right" :class="{ 'dimmed-info': isDrawing }">
      <span class="bottom-copyright">© {{ currentYear }} 信息科组小李 · 抽签系统 v{{ appVersion }}</span>
    </div>
  </footer>
</template>
