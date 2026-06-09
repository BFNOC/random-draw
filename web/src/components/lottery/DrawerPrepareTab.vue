<script setup>
import { computed } from 'vue'
import { Aim, Delete, Setting, Upload } from '@element-plus/icons-vue'

const props = defineProps({
  allPickedCount: {
    type: Number,
    required: true
  },
  batchSize: {
    type: Number,
    required: true
  },
  isDrawing: {
    type: Boolean,
    required: true
  },
  maxPickCount: {
    type: Number,
    required: true
  },
  minPickCount: {
    type: Number,
    required: true
  },
  nameCount: {
    type: Number,
    required: true
  },
  nameInput: {
    type: String,
    required: true
  },
  readinessStatus: {
    type: String,
    required: true
  },
  remainingCount: {
    type: Number,
    required: true
  },
  totalBatches: {
    type: Number,
    required: true
  }
})

const emit = defineEmits([
  'clear-input',
  'trigger-file-select',
  'update:batchSize',
  'update:nameInput',
  'update:totalBatches'
])

const nameInputModel = computed({
  get: () => props.nameInput,
  set: value => emit('update:nameInput', value)
})

const batchSizeModel = computed({
  get: () => props.batchSize,
  set: value => emit('update:batchSize', value)
})

const totalBatchesModel = computed({
  get: () => props.totalBatches,
  set: value => emit('update:totalBatches', value)
})
</script>

<template>
  <div class="drawer-tab-panel">
    <section class="settings-section prep-summary-section">
      <div class="prep-summary">
        <span class="prep-status">{{ readinessStatus }}</span>
        <strong>{{ remainingCount }} / {{ nameCount }}</strong>
        <span>剩余可抽人数</span>
      </div>
      <p class="prep-helper">主持现场只需要先完成名单和单批人数，音效与历史记录可稍后处理。</p>
    </section>

    <section class="settings-section">
      <h3 class="section-title"><el-icon><Setting /></el-icon> 抽签基本设置</h3>
      <div class="settings-form">
        <div class="form-row">
          <div class="form-item half">
            <label for="batch-size-input">单批抽取人数</label>
            <el-input-number
              id="batch-size-input"
              v-model="batchSizeModel"
              :min="minPickCount"
              :max="maxPickCount"
              aria-label="单批抽取人数"
              class="w-full"
            />
          </div>
          <div class="form-item half">
            <label for="total-batches-input">总抽取轮数</label>
            <el-input-number
              id="total-batches-input"
              v-model="totalBatchesModel"
              :min="1"
              :max="100"
              aria-label="总抽取轮数"
              class="w-full"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header-flex">
        <h3 class="section-title"><el-icon><Aim /></el-icon> 名单管理</h3>
        <div class="header-action-group">
          <el-button type="primary" size="small" :disabled="isDrawing" @click="emit('trigger-file-select')">
            <el-icon><Upload /></el-icon> 导入
          </el-button>
          <el-button type="danger" size="small" :disabled="isDrawing" plain @click="emit('clear-input')">
            <el-icon><Delete /></el-icon> 清空
          </el-button>
        </div>
      </div>

      <el-input
        v-model="nameInputModel"
        type="textarea"
        :rows="10"
        placeholder="请输入名单，每行一个名字。也可以点击导入选择 TXT 文件。"
        :disabled="isDrawing"
        class="name-list-textarea"
      />

      <div class="inline-stat-list" aria-label="名单统计">
        <span>名单 {{ nameCount }} 人</span>
        <span>已抽 {{ allPickedCount }} 人</span>
        <span>剩余 {{ remainingCount }} 人</span>
      </div>
    </section>
  </div>
</template>
