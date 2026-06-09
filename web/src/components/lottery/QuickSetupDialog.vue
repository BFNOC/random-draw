<script setup>
import { computed } from 'vue'

const props = defineProps({
  batchSize: {
    type: Number,
    required: true
  },
  remainingCount: {
    type: Number,
    required: true
  },
  totalBatches: {
    type: Number,
    required: true
  },
  visible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['confirm', 'sync-aria', 'update:batchSize', 'update:totalBatches', 'update:visible'])

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
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
  <el-dialog
    v-model="visibleModel"
    title="抽奖设置"
    width="min(420px, calc(100vw - 32px))"
    class="quick-setup-dialog"
    :close-on-click-modal="false"
    :show-close="false"
    align-center
    @opened="emit('sync-aria')"
  >
    <div class="quick-setup-body">
      <p class="quick-setup-copy">名单已进入 3D 舞台，确认每轮抽取人数和总轮数后即可开始。</p>
      <div class="quick-setup-grid">
        <label class="quick-setup-field" for="quick-batch-size-input">
          <span>每轮抽取</span>
          <el-input-number
            id="quick-batch-size-input"
            v-model="batchSizeModel"
            :min="1"
            :max="Math.max(1, remainingCount)"
            aria-label="每轮抽取人数"
            class="w-full"
          />
        </label>
        <label class="quick-setup-field" for="quick-total-batches-input">
          <span>抽取轮数</span>
          <el-input-number
            id="quick-total-batches-input"
            v-model="totalBatchesModel"
            :min="1"
            :max="100"
            aria-label="抽取轮数"
            class="w-full"
          />
        </label>
      </div>
    </div>
    <template #footer>
      <div class="quick-setup-actions">
        <el-button @click="emit('update:visible', false)">稍后设置</el-button>
        <el-button type="primary" @click="emit('confirm')">确认</el-button>
      </div>
    </template>
  </el-dialog>
</template>
