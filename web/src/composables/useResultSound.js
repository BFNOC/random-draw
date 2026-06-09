import { computed, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createCustomResultSoundActions,
  createSynthResultSoundActions
} from '../utils/resultSoundActions'

export const useResultSound = () => {
  const state = createResultSoundState()
  const customSound = createCustomResultSoundActions(state)
  const synthSound = createSynthResultSoundActions()

  const triggerAudioFileSelect = () => {
    state.audioFileInputRef.value?.click()
  }

  const handleAudioFileImport = async (event) => {
    await customSound.handleAudioFileImport(event)
  }

  const prepareResultSound = async () => {
    if (state.hasCustomResultSound.value) await customSound.prepareCustomSound()
    await synthSound.prepareSynthResultSound()
  }

  const playDrawCompleteSound = async () => {
    const playedCustomSound = await customSound.playCustomSound()
    if (playedCustomSound) return

    if (state.hasCustomResultSound.value) ElMessage.warning('本地音效播放失败，已使用合成音效')
    await synthSound.playSynthResultSound()
  }

  const previewResultSound = async () => {
    await prepareResultSound()
    await playDrawCompleteSound()
  }

  const cleanupResultSound = () => {
    customSound.clearCustomResultSound(false)
    synthSound.cleanupSynthResultSound()
  }

  onUnmounted(cleanupResultSound)

  return {
    audioFileInputRef: state.audioFileInputRef,
    hasCustomResultSound: state.hasCustomResultSound,
    resultSoundLabel: state.resultSoundLabel,
    clearCustomResultSound: customSound.clearCustomResultSound,
    handleAudioFileImport,
    prepareResultSound,
    playDrawCompleteSound,
    previewResultSound,
    triggerAudioFileSelect
  }
}

const createResultSoundState = () => {
  const customAudioName = ref('')
  const customAudioElement = ref(null)

  return {
    audioFileInputRef: ref(null),
    customAudioElement,
    customAudioName,
    hasCustomResultSound: computed(() => Boolean(customAudioElement.value)),
    resultSoundLabel: computed(() => customAudioName.value || '合成音效')
  }
}
