<script setup>
import { computed } from 'vue'

const props = defineProps({
  drawSize: {
    type: Number,
    required: true
  },
  drawTimes: {
    type: Number,
    required: true
  },
  prizeName: {
    type: String,
    required: true
  },
  remainingCount: {
    type: Number,
    required: true
  },
  visible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits([
  'confirm',
  'sync-aria',
  'update:drawSize',
  'update:drawTimes',
  'update:prizeName',
  'update:visible'
])

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value)
})

const prizeNameModel = computed({
  get: () => props.prizeName,
  set: value => emit('update:prizeName', value)
})

const drawSizeModel = computed({
  get: () => props.drawSize,
  set: value => emit('update:drawSize', value)
})

const drawTimesModel = computed({
  get: () => props.drawTimes,
  set: value => emit('update:drawTimes', value)
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
      <p class="quick-setup-copy">名单已进入 3D 舞台，先配置一个奖项，后续可在设置中继续添加。</p>
      <label class="quick-setup-field" for="quick-prize-name-input">
        <span>奖项名称</span>
        <el-input
          id="quick-prize-name-input"
          v-model="prizeNameModel"
          aria-label="奖项名称"
          placeholder="如：一等奖"
        />
      </label>
      <div class="quick-setup-grid">
        <label class="quick-setup-field" for="quick-batch-size-input">
          <span>每次人数</span>
          <el-input-number
            id="quick-batch-size-input"
            v-model="drawSizeModel"
            :min="1"
            :max="Math.max(1, remainingCount)"
            aria-label="每次抽取人数"
            class="w-full"
          />
        </label>
        <label class="quick-setup-field" for="quick-total-batches-input">
          <span>抽取次数</span>
          <el-input-number
            id="quick-total-batches-input"
            v-model="drawTimesModel"
            :min="1"
            :max="9999"
            aria-label="抽取次数"
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
