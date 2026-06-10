<script setup>
import { computed } from 'vue'
import { parseResultDisplayName } from '../../utils/resultNameDisplay'

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

const displayNames = computed(() => props.names.map(parseResultDisplayName))

const getCardClass = (index) => {
  if (props.staticRevealed) return { 'is-revealed': true }

  return {
    'is-rolling': props.isDrawing && (!props.isRevealing || index >= props.revealedCount),
    'is-revealed': !props.isDrawing || (props.isRevealing && index < props.revealedCount)
  }
}

const getNumberedNameScale = (count) => {
  if (count <= 2) return 0.68
  if (count <= 8) return 0.72
  if (count <= 16) return 0.76
  return 0.8
}

const scaleCssValue = (value, scale) => value ? `calc(${value} * ${scale})` : value

const getDisplayNameStyle = (displayName) => {
  const styles = props.getNameStyle(displayName.styleName, props.names.length)
  if (!displayName.isNumbered) return styles

  const scale = getNumberedNameScale(props.names.length)
  return {
    ...styles,
    fontSize: scaleCssValue(styles.fontSize, scale),
    padding: scaleCssValue(styles.padding, props.names.length <= 8 ? 0.72 : 0.82)
  }
}
</script>

<template>
  <div :style="gridStyle" class="interactive-grid">
    <div
      v-for="(displayName, index) in displayNames"
      :key="`${displayName.raw}-${index}`"
      class="name-card-wrapper"
    >
      <div class="name-card" :class="getCardClass(index)">
        <span
          class="name-text"
          :class="{ 'name-text--numbered': displayName.isNumbered }"
          :style="getDisplayNameStyle(displayName)"
          :aria-label="displayName.ariaLabel"
          :title="displayName.raw"
        >
          <template v-if="displayName.isNumbered">
            <span class="name-number">{{ displayName.number }}</span>
            <span class="name-person">{{ displayName.personName }}</span>
          </template>
          <template v-else>{{ displayName.raw }}</template>
        </span>
        <div class="card-glow"></div>
      </div>
    </div>
  </div>
</template>
