<script setup>
const props = defineProps({
  getNameStyle: {
    type: Function,
    required: true
  },
  gridStyle: {
    type: Object,
    default: () => ({})
  },
  isDrawing: {
    type: Boolean,
    default: false
  },
  isRevealing: {
    type: Boolean,
    default: false
  },
  names: {
    type: Array,
    default: () => []
  },
  revealedCount: {
    type: Number,
    default: 0
  },
  staticRevealed: {
    type: Boolean,
    default: false
  }
})

const getCardClass = (index) => {
  if (props.staticRevealed) return { 'is-revealed': true }

  return {
    'is-rolling': props.isDrawing && (!props.isRevealing || index >= props.revealedCount),
    'is-revealed': !props.isDrawing || (props.isRevealing && index < props.revealedCount)
  }
}
</script>

<template>
  <div :style="gridStyle" class="interactive-grid">
    <div
      v-for="(name, index) in names"
      :key="`${name}-${index}`"
      class="name-card-wrapper"
    >
      <div class="name-card" :class="getCardClass(index)">
        <span class="name-text" :style="getNameStyle(name, names.length)">{{ name }}</span>
        <div class="card-glow"></div>
      </div>
    </div>
  </div>
</template>
