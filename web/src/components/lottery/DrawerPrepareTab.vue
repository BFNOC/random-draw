<script setup>
import { computed } from 'vue'
import { Aim, Delete, Setting, Upload } from '@element-plus/icons-vue'
import PrizePlanEditor from './PrizePlanEditor.vue'

const props = defineProps({
  allPickedCount: {
    type: Number,
    required: true
  },
  isDrawing: {
    type: Boolean,
    required: true
  },
  plannedWinnerCount: {
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
  prizeItems: {
    type: Array,
    default: () => []
  },
  readinessStatus: {
    type: String,
    required: true
  },
  remainingCount: {
    type: Number,
    required: true
  },
  totalDrawCount: {
    type: Number,
    required: true
  },
  validPrizeCount: {
    type: Number,
    required: true
  }
})

const emit = defineEmits([
  'clear-input',
  'trigger-file-select',
  'update:nameInput',
  'update:prizeItems'
])

const nameInputModel = computed({
  get: () => props.nameInput,
  set: value => emit('update:nameInput', value)
})

const prizeItemsModel = computed({
  get: () => props.prizeItems,
  set: value => emit('update:prizeItems', value)
})

const inputLocked = computed(() => props.isDrawing || props.allPickedCount > 0)
const prizePlanLocked = computed(() => props.isDrawing || props.allPickedCount > 0)
</script>

<template>
  <div class="drawer-tab-panel">
    <section class="settings-section prep-summary-section">
      <div class="prep-summary">
        <span class="prep-status">{{ readinessStatus }}</span>
        <strong>{{ remainingCount }} / {{ nameCount }}</strong>
        <span>剩余可抽人数</span>
      </div>
      <p class="prep-helper">
        {{ validPrizeCount > 0 ? `已配置 ${validPrizeCount} 个奖项，共 ${totalDrawCount} 次，计划中奖 ${plannedWinnerCount} 人。` : '先完成名单和奖项设置，音效与历史记录可稍后处理。' }}
      </p>
    </section>

    <section class="settings-section">
      <h3 class="section-title"><el-icon><Setting /></el-icon> 奖项设置</h3>
      <PrizePlanEditor v-model="prizeItemsModel" :disabled="prizePlanLocked" />
      <p v-if="allPickedCount > 0" class="settings-lock-hint">已有抽取结果，重置抽签数据后可修改奖项。</p>
    </section>

    <section class="settings-section">
      <div class="section-header-flex">
        <h3 class="section-title"><el-icon><Aim /></el-icon> 名单管理</h3>
        <div class="header-action-group">
          <el-button type="primary" size="small" :disabled="inputLocked" @click="emit('trigger-file-select')">
            <el-icon><Upload /></el-icon> 导入
          </el-button>
          <el-button type="danger" size="small" :disabled="inputLocked" plain @click="emit('clear-input')">
            <el-icon><Delete /></el-icon> 清空
          </el-button>
        </div>
      </div>

      <el-input
        v-model="nameInputModel"
        type="textarea"
        :rows="10"
        placeholder="请输入名单，每行一个名字。也可以点击导入选择 TXT 文件。"
        :disabled="inputLocked"
        class="name-list-textarea"
      />
      <p v-if="allPickedCount > 0" class="settings-lock-hint">已有抽取结果，重置抽签数据后可修改名单。</p>

      <div class="inline-stat-list" aria-label="名单统计">
        <span>名单 {{ nameCount }} 人</span>
        <span>已抽 {{ allPickedCount }} 人</span>
        <span>剩余 {{ remainingCount }} 人</span>
      </div>
    </section>
  </div>
</template>
