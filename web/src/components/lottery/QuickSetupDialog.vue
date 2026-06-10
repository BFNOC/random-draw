<script setup>
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import PrizePlanEditor from './PrizePlanEditor.vue'

const props = defineProps({
  hasStoredSettings: {
    type: Boolean,
    default: false
  },
  prizeItems: {
    type: Array,
    default: () => []
  },
  storedPrizeItems: {
    type: Array,
    default: () => []
  },
  storedSettingsWarning: {
    type: String,
    default: ''
  },
  visible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits([
  'apply-stored-settings',
  'clear-stored-settings',
  'confirm',
  'sync-aria',
  'update:prizeItems',
  'update:visible'
])

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const prizeItemsModel = computed({
  get: () => props.prizeItems,
  set: value => emit('update:prizeItems', value)
})

const hasUsableStoredSettings = computed(() => props.hasStoredSettings && props.storedPrizeItems.length > 0)
</script>

<template>
  <el-dialog
    v-model="visibleModel"
    title="抽奖设置"
    width="min(720px, calc(100vw - 32px))"
    class="quick-setup-dialog"
    :close-on-click-modal="false"
    :show-close="false"
    align-center
    @opened="emit('sync-aria')"
  >
    <div class="quick-setup-body">
      <p class="quick-setup-copy">名单已进入 3D 舞台，直接配置一个或多个奖项。</p>
      <p class="quick-setup-tip">每次人数建议控制在 50 人以内，以保证最佳展示效果。</p>
      <section v-if="hasUsableStoredSettings" class="quick-setup-saved-panel" aria-label="上次保存的抽奖设置">
        <div class="quick-setup-saved-header">
          <div>
            <strong>上次保存</strong>
            <span>{{ storedSettingsWarning ? '当前名单不可直接使用' : '当前名单可直接使用' }}</span>
          </div>
          <el-button type="success" plain :disabled="Boolean(storedSettingsWarning)" @click="emit('apply-stored-settings')">
            使用上次设置
          </el-button>
        </div>
        <p v-if="storedSettingsWarning" class="quick-setup-saved-warning">{{ storedSettingsWarning }}</p>
        <ul class="quick-setup-saved-list">
          <li v-for="item in storedPrizeItems" :key="item.id">
            <b>{{ item.name }}</b>
            <span>每次 {{ item.drawSize }} 人，共 {{ item.drawTimes }} 次，合计 {{ item.drawSize * item.drawTimes }} 人</span>
          </li>
        </ul>
      </section>
      <PrizePlanEditor v-model="prizeItemsModel" />
    </div>
    <template #footer>
      <div class="quick-setup-actions">
        <div class="quick-setup-secondary-actions">
          <el-button type="danger" plain :disabled="!hasStoredSettings" @click="emit('clear-stored-settings')">
            <el-icon><Delete /></el-icon>
            <span>清除保存</span>
          </el-button>
        </div>
        <div class="quick-setup-primary-actions">
          <el-button @click="emit('update:visible', false)">稍后设置</el-button>
          <el-button type="primary" @click="emit('confirm')">确认</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
