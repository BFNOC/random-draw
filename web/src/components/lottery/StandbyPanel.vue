<script setup>
import { Setting, Upload, VideoPlay } from '@element-plus/icons-vue'

defineProps({
  batchSize: {
    type: Number,
    required: true
  },
  canStartDraw: {
    type: Boolean,
    required: true
  },
  completedBatchCount: {
    type: Number,
    required: true
  },
  currentPrizeDraw: {
    type: Object,
    default: null
  },
  nameCount: {
    type: Number,
    required: true
  },
  remainingCount: {
    type: Number,
    required: true
  },
  setupSteps: {
    type: Array,
    required: true
  },
  totalBatches: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['open-drawer', 'start-draw'])
</script>

<template>
  <div class="empty-placeholder-container">
    <section class="center-dashboard-card" aria-labelledby="standby-title">
      <div class="standby-main">
        <div class="standby-kicker">现场准备</div>
        <h1 id="standby-title" class="dashboard-title">
          {{ nameCount > 0 ? '名单已就绪' : '抽签待开始' }}
        </h1>
        <p class="dashboard-subtitle">
          {{ nameCount > 0 ? `${nameCount} 人进入奖池，配置奖项后即可开始。` : '先导入名单，再配置奖项名称、人数和次数。' }}
        </p>

        <div v-if="currentPrizeDraw" class="standby-prize-chip" aria-label="当前奖项">
          <span>当前</span>
          <strong>{{ currentPrizeDraw.prizeName }}</strong>
          <em>第 {{ currentPrizeDraw.roundIndex }} / {{ currentPrizeDraw.totalRounds }} 次</em>
          <b>{{ currentPrizeDraw.drawSize }} 人</b>
        </div>

        <div class="standby-actions" aria-label="抽签准备操作">
          <el-button
            type="primary"
            class="standby-primary-btn"
            :disabled="nameCount > 0 && !canStartDraw"
            @click="nameCount === 0 ? emit('open-drawer', 'prepare') : emit('start-draw')"
          >
            <el-icon>
              <Upload v-if="nameCount === 0" />
              <VideoPlay v-else />
            </el-icon>
            <span>{{ nameCount === 0 ? '导入名单' : '开始抽签' }}</span>
          </el-button>
          <el-button class="standby-secondary-btn" @click="emit('open-drawer', 'prepare')">
            <el-icon><Setting /></el-icon>
            <span>准备设置</span>
          </el-button>
        </div>
      </div>

      <div class="setup-progress" aria-label="准备进度">
        <div
          v-for="(step, index) in setupSteps"
          :key="step.label"
          class="setup-step"
          :class="{ 'is-done': step.done, 'is-current': !step.done && setupSteps.slice(0, index).every(item => item.done) }"
        >
          <span class="setup-step-index">{{ index + 1 }}</span>
          <span class="setup-step-copy">
            <span class="setup-step-label">{{ step.label }}</span>
            <span class="setup-step-detail">{{ step.detail }}</span>
          </span>
        </div>
      </div>

      <dl class="standby-metrics" aria-label="抽签状态概览">
        <div>
          <dt>名单</dt>
          <dd>{{ nameCount }} 人</dd>
        </div>
        <div>
          <dt>本次</dt>
          <dd>{{ batchSize }} 人</dd>
        </div>
        <div>
          <dt>剩余</dt>
          <dd>{{ remainingCount }} 人</dd>
        </div>
        <div>
          <dt>进度</dt>
          <dd>{{ completedBatchCount }} / {{ totalBatches }} 次</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
