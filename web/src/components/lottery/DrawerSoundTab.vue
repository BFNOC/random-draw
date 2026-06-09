<script setup>
import { Refresh, Upload, VideoPlay } from '@element-plus/icons-vue'

defineProps({
  hasCustomResultSound: {
    type: Boolean,
    required: true
  },
  isDrawing: {
    type: Boolean,
    required: true
  },
  resultSoundLabel: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['clear-sound', 'preview-sound', 'trigger-audio-file-select'])
</script>

<template>
  <div class="drawer-tab-panel">
    <section class="settings-section">
      <h3 class="section-title"><el-icon><VideoPlay /></el-icon> 结束音效</h3>
      <div class="sound-panel-box">
        <div class="sound-current-row">
          <span class="sound-label">当前音效</span>
          <span
            class="sound-name"
            :class="{ 'is-custom': hasCustomResultSound }"
            :title="resultSoundLabel"
          >
            {{ resultSoundLabel }}
          </span>
        </div>
        <div class="sound-action-row">
          <el-button size="small" type="primary" :disabled="isDrawing" @click="emit('trigger-audio-file-select')">
            <el-icon><Upload /></el-icon> 选择音频
          </el-button>
          <el-button size="small" :disabled="isDrawing" @click="emit('preview-sound')">
            <el-icon><VideoPlay /></el-icon> 试听
          </el-button>
          <el-button
            size="small"
            :disabled="isDrawing || !hasCustomResultSound"
            @click="emit('clear-sound')"
          >
            <el-icon><Refresh /></el-icon> 合成音
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>
