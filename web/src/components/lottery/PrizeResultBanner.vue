<script setup>
defineProps({
  drawInfo: {
    type: Object,
    default: null
  },
  label: {
    type: String,
    default: '本轮结果'
  }
})
</script>

<template>
  <div v-if="drawInfo" class="prize-result-banner" aria-label="当前奖品">
    <span class="prize-result-label">{{ label }}</span>
    <strong class="prize-result-name">{{ drawInfo.prizeName }}</strong>
    <span class="prize-result-meta">第 {{ drawInfo.roundIndex }} / {{ drawInfo.totalRounds }} 次</span>
    <span class="prize-result-count">{{ drawInfo.drawSize }} 人</span>
  </div>
</template>
