<script setup>
import { nextTick } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { syncLocalizedNumberControls } from '../../utils/lotterySetupHelpers'
import { createPrizeItem } from '../../utils/prizePlan'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const addPrizeItem = () => {
  emit('update:modelValue', [...props.modelValue, createPrizeItem()])
  syncLocalizedNumberControls(nextTick)
}

const removePrizeItem = (id) => {
  emit('update:modelValue', props.modelValue.filter(item => item.id !== id))
}

const updatePrizeItem = (id, patch) => {
  emit('update:modelValue', props.modelValue.map(item => {
    return item.id === id ? { ...item, ...patch } : item
  }))
}

const getPrizeLabel = (item, index) => item.name || `第 ${index + 1} 个奖项`
</script>

<template>
  <div class="prize-plan-editor">
    <div v-if="modelValue.length === 0" class="prize-plan-empty">
      暂无奖项，请先添加奖项。
    </div>

    <div v-else class="prize-plan-list" aria-label="奖项列表">
      <div class="prize-plan-head" aria-hidden="true">
        <span>奖项名称</span>
        <span>每次人数</span>
        <span>抽取次数</span>
        <span>操作</span>
      </div>

      <div v-for="(item, index) in modelValue" :key="item.id" class="prize-plan-row">
        <el-input
          :model-value="item.name"
          :disabled="disabled"
          :aria-label="`第 ${index + 1} 个奖项名称`"
          placeholder="如：一等奖"
          @update:model-value="value => updatePrizeItem(item.id, { name: value })"
        />
        <el-input-number
          :model-value="item.drawSize"
          :disabled="disabled"
          :min="1"
          :max="9999"
          :aria-label="`${getPrizeLabel(item, index)}每次抽取人数`"
          @update:model-value="value => updatePrizeItem(item.id, { drawSize: value })"
        />
        <el-input-number
          :model-value="item.drawTimes"
          :disabled="disabled"
          :min="1"
          :max="9999"
          :aria-label="`${getPrizeLabel(item, index)}抽取次数`"
          @update:model-value="value => updatePrizeItem(item.id, { drawTimes: value })"
        />
        <el-button
          type="danger"
          size="small"
          plain
          :disabled="disabled"
          :aria-label="`删除第 ${index + 1} 个奖项`"
          @click="removePrizeItem(item.id)"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>

    <el-button class="prize-add-btn" :disabled="disabled" @click="addPrizeItem">
      <el-icon><Plus /></el-icon>
      <span>添加奖项</span>
    </el-button>
  </div>
</template>
