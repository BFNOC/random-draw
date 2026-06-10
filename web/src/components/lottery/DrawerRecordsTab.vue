<script setup>
import { Download, Refresh, VideoPlay } from '@element-plus/icons-vue'

defineProps({
  historyRecords: {
    type: Array,
    default: () => []
  },
  isDrawing: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['export-history', 'reset'])
</script>

<template>
  <div class="drawer-tab-panel records-panel">
    <section class="settings-section">
      <h3 class="section-title"><el-icon><Refresh /></el-icon> 数据导出与重置</h3>
      <div class="action-grid-buttons">
        <el-button
          type="success"
          class="action-btn-wide"
          :disabled="historyRecords.length === 0"
          @click="emit('export-history')"
        >
          <el-icon><Download /></el-icon> 导出抽奖结果
        </el-button>
        <el-button type="danger" class="action-btn-wide" :disabled="isDrawing" plain @click="emit('reset')">
          <el-icon><Refresh /></el-icon> 重置所有抽签数据
        </el-button>
      </div>
    </section>

    <section class="settings-section flex-column-fill">
      <h3 class="section-title"><el-icon><VideoPlay /></el-icon> 历史抽奖结果</h3>
      <div class="drawer-history-list">
        <div v-if="historyRecords.length === 0" class="empty-history-placeholder">
          暂无历史抽奖结果
        </div>
        <div v-else class="history-list-cards">
          <div v-for="record in historyRecords" :key="record.batch" class="history-record-card">
            <div class="history-record-card-header">
              <span class="record-batch-badge">{{ record.prizeName }}</span>
              <span class="record-count-badge">第 {{ record.roundIndex }}/{{ record.totalRounds }} 次，抽取 {{ record.names.length }} 人</span>
            </div>
            <div class="history-record-card-names">
              <span v-for="(name, idx) in record.names" :key="idx" class="history-name-tag">
                {{ name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
