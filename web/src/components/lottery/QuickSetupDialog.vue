<script setup>
import { computed } from 'vue'
import PrizePlanEditor from './PrizePlanEditor.vue'

const props = defineProps({
  prizeItems: {
    type: Array,
    default: () => []
  },
  visible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits([
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
      <PrizePlanEditor v-model="prizeItemsModel" />
    </div>
    <template #footer>
      <div class="quick-setup-actions">
        <el-button @click="emit('update:visible', false)">稍后设置</el-button>
        <el-button type="primary" @click="emit('confirm')">确认</el-button>
      </div>
    </template>
  </el-dialog>
</template>
