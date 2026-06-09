import { ElMessage } from 'element-plus'
import {
  createValidatedAudioElement,
  getAudioContext,
  isSupportedResultSoundFile,
  playCustomAudio,
  playSynthNotes,
  prepareCustomAudio,
  resumeAudioContext
} from './resultSound'

export const createCustomResultSoundActions = (state) => {
  let customAudioObjectUrl = ''

  const resetAudioFileInput = () => {
    if (state.audioFileInputRef.value) state.audioFileInputRef.value.value = ''
  }

  const clearCustomResultSound = (showMessage = true) => {
    releaseCustomAudio(state.customAudioElement.value)
    state.customAudioElement.value = null
    state.customAudioName.value = ''
    customAudioObjectUrl = revokeCustomAudioUrl(customAudioObjectUrl)
    resetAudioFileInput()
    if (showMessage) ElMessage.success('已恢复合成音效')
  }

  const handleAudioFileImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isSupportedResultSoundFile(file)) {
      rejectUnsupportedAudio(clearCustomResultSound, resetAudioFileInput)
      return
    }

    customAudioObjectUrl = await loadCustomAudio(state, clearCustomResultSound, file)
    resetAudioFileInput()
  }

  return {
    clearCustomResultSound,
    handleAudioFileImport,
    playCustomSound: () => playCustomAudio(state.customAudioElement.value),
    prepareCustomSound: () => prepareCustomAudio(state.customAudioElement.value)
  }
}

export const createSynthResultSoundActions = () => {
  let audioContext = null

  const prepareSynthResultSound = async () => {
    audioContext = getAudioContext(audioContext)
    await resumeAudioContext(audioContext, '抽签音效初始化失败')
  }

  const playSynthResultSound = async () => {
    audioContext = getAudioContext(audioContext)
    if (!audioContext) return

    try {
      await resumeAudioContext(audioContext, '播放抽签完成音效失败')
      playSynthNotes(audioContext)
    } catch (error) {
      console.warn('播放抽签完成音效失败', error)
    }
  }

  const cleanupSynthResultSound = () => {
    if (!audioContext || audioContext.state === 'closed') return

    audioContext.close().catch((error) => {
      console.warn('抽签音效上下文关闭失败', error)
    })
  }

  return {
    cleanupSynthResultSound,
    playSynthResultSound,
    prepareSynthResultSound
  }
}

const loadCustomAudio = async (state, clearCustomResultSound, file) => {
  const objectUrl = URL.createObjectURL(file)

  try {
    const audio = await createValidatedAudioElement(objectUrl)
    clearCustomResultSound(false)
    state.customAudioElement.value = audio
    state.customAudioName.value = file.name
    ElMessage.success('已启用本地结束音效')
    return objectUrl
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    clearCustomResultSound(false)
    console.warn('本地结束音效加载失败', error)
    ElMessage.error('音频文件无法播放，已使用合成音效')
    return ''
  }
}

const rejectUnsupportedAudio = (clearCustomResultSound, resetAudioFileInput) => {
  ElMessage.error('请选择 MP3 或 WAV 音频文件')
  clearCustomResultSound(false)
  resetAudioFileInput()
}

const releaseCustomAudio = (audio) => {
  if (!audio) return

  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

const revokeCustomAudioUrl = (objectUrl) => {
  if (!objectUrl) return ''

  URL.revokeObjectURL(objectUrl)
  return ''
}
