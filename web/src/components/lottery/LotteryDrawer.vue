<script setup>
import { computed } from 'vue'
import { Aim, Close, Download, VideoPlay } from '@element-plus/icons-vue'
import DrawerPrepareTab from './DrawerPrepareTab.vue'
import DrawerRecordsTab from './DrawerRecordsTab.vue'
import DrawerSoundTab from './DrawerSoundTab.vue'

const props = defineProps({
  activeTab: { type: String, required: true },
  allPickedCount: { type: Number, required: true },
  appVersion: { type: String, required: true },
  currentYear: { type: Number, required: true },
  hasCustomResultSound: { type: Boolean, required: true },
  historyRecords: { type: Array, default: () => [] },
  isDrawing: { type: Boolean, required: true },
  nameCount: { type: Number, required: true },
  nameInput: { type: String, required: true },
  plannedWinnerCount: { type: Number, required: true },
  prizeItems: { type: Array, default: () => [] },
  readinessStatus: { type: String, required: true },
  remainingCount: { type: Number, required: true },
  resultSoundLabel: { type: String, required: true },
  totalDrawCount: { type: Number, required: true },
  validPrizeCount: { type: Number, required: true },
  visible: { type: Boolean, required: true }
})

const emit = defineEmits([
  'clear-input',
  'clear-sound',
  'export-history',
  'preview-sound',
  'reset',
  'sync-aria',
  'trigger-audio-file-select',
  'trigger-file-select',
  'update:activeTab',
  'update:nameInput',
  'update:prizeItems',
  'update:visible'
])

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const activeTabModel = computed({
  get: () => props.activeTab,
  set: value => emit('update:activeTab', value)
})
</script>

<template>
  <el-drawer
    v-model="visibleModel"
    title="抽签系统控制台"
    direction="rtl"
    size="min(520px, 100vw)"
    class="tech-drawer"
    :destroy-on-close="false"
    :show-close="false"
    @opened="emit('sync-aria')"
  >
    <template #header>
      <div class="drawer-custom-header">
        <div>
          <p class="drawer-eyebrow">抽签控制台</p>
          <h2>现场准备</h2>
        </div>
        <button class="drawer-close-btn" type="button" aria-label="关闭抽签控制台" @click="emit('update:visible', false)">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="drawer-layout-container">
      <el-tabs v-model="activeTabModel" class="drawer-tabs">
        <el-tab-pane name="prepare">
          <template #label>
            <span class="drawer-tab-label"><el-icon><Aim /></el-icon> 准备</span>
          </template>
          <DrawerPrepareTab
            :all-picked-count="allPickedCount"
            :is-drawing="isDrawing"
            :name-count="nameCount"
            :name-input="nameInput"
            :planned-winner-count="plannedWinnerCount"
            :prize-items="prizeItems"
            :readiness-status="readinessStatus"
            :remaining-count="remainingCount"
            :total-draw-count="totalDrawCount"
            :valid-prize-count="validPrizeCount"
            @clear-input="emit('clear-input')"
            @trigger-file-select="emit('trigger-file-select')"
            @update:name-input="value => emit('update:nameInput', value)"
            @update:prize-items="value => emit('update:prizeItems', value)"
          />
        </el-tab-pane>

        <el-tab-pane name="sound">
          <template #label>
            <span class="drawer-tab-label"><el-icon><VideoPlay /></el-icon> 音效</span>
          </template>
          <DrawerSoundTab
            :has-custom-result-sound="hasCustomResultSound"
            :is-drawing="isDrawing"
            :result-sound-label="resultSoundLabel"
            @clear-sound="emit('clear-sound')"
            @preview-sound="emit('preview-sound')"
            @trigger-audio-file-select="emit('trigger-audio-file-select')"
          />
        </el-tab-pane>

        <el-tab-pane name="records">
          <template #label>
            <span class="drawer-tab-label"><el-icon><Download /></el-icon> 记录</span>
          </template>
          <DrawerRecordsTab
            :history-records="historyRecords"
            :is-drawing="isDrawing"
            @export-history="emit('export-history')"
            @reset="emit('reset')"
          />
        </el-tab-pane>
      </el-tabs>

      <footer class="drawer-footer-copyright">
        <span>© {{ currentYear }} 信息科组小李 · 抽签系统 v{{ appVersion }}</span>
      </footer>
    </div>
  </el-drawer>
</template>
