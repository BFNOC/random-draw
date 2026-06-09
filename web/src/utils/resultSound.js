import { SUPPORTED_RESULT_SOUND_MIME_TYPES, SYNTH_RESULT_NOTES } from '../constants/lottery'

export const isSupportedResultSoundFile = (file) => {
  const fileName = file.name.toLowerCase()

  return SUPPORTED_RESULT_SOUND_MIME_TYPES.includes(file.type)
    || fileName.endsWith('.mp3')
    || fileName.endsWith('.wav')
}

export const createValidatedAudioElement = (objectUrl) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    let settled = false
    let timer = 0

    const finish = (callback) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      callback()
    }

    timer = window.setTimeout(() => finish(() => reject(new Error('结束音效加载超时'))), 5000)
    audio.preload = 'auto'
    audio.onloadedmetadata = () => finish(() => resolve(audio))
    audio.onerror = () => finish(() => reject(new Error('结束音效无法播放')))
    audio.src = objectUrl
    audio.load()
  })
}

export const getAudioContext = (currentContext) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!currentContext || currentContext.state === 'closed') return new AudioContextClass()
  return currentContext
}

export const resumeAudioContext = async (context, warningMessage) => {
  if (!context || context.state !== 'suspended') return

  try {
    await context.resume()
  } catch (error) {
    console.warn(warningMessage, error)
  }
}

export const prepareCustomAudio = async (audio) => {
  if (!audio) return

  const previousVolume = audio.volume
  try {
    audio.pause()
    audio.currentTime = 0
    audio.volume = 0
    await audio.play()
    audio.pause()
    audio.currentTime = 0
  } catch (error) {
    console.warn('本地结束音效初始化失败', error)
  } finally {
    audio.volume = previousVolume
  }
}

export const playCustomAudio = async (audio) => {
  if (!audio) return false

  try {
    audio.pause()
    audio.currentTime = 0
    audio.muted = false
    await audio.play()
    return true
  } catch (error) {
    console.warn('播放本地结束音效失败', error)
    return false
  }
}

export const playSynthNotes = (context) => {
  const now = context.currentTime
  const masterGain = context.createGain()

  masterGain.gain.setValueAtTime(0.0001, now)
  masterGain.gain.exponentialRampToValueAtTime(0.42, now + 0.03)
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15)
  masterGain.connect(context.destination)
  SYNTH_RESULT_NOTES.forEach(note => playSynthNote(context, masterGain, now, note))
  playShimmerNote(context, masterGain, now)
  releaseMasterGain(masterGain)
}

export const playSynthNote = (context, masterGain, now, note) => {
  const oscillator = context.createOscillator()
  const noteGain = context.createGain()
  const startAt = now + note.start
  const stopAt = startAt + note.duration

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(note.frequency, startAt)
  noteGain.gain.setValueAtTime(0.0001, startAt)
  noteGain.gain.exponentialRampToValueAtTime(note.volume, startAt + 0.02)
  noteGain.gain.exponentialRampToValueAtTime(0.0001, stopAt)
  oscillator.connect(noteGain)
  noteGain.connect(masterGain)
  oscillator.start(startAt)
  oscillator.stop(stopAt + 0.04)
}

export const playShimmerNote = (context, masterGain, now) => {
  const shimmer = context.createOscillator()
  const shimmerGain = context.createGain()

  shimmer.type = 'sine'
  shimmer.frequency.setValueAtTime(1567.98, now + 0.52)
  shimmer.frequency.exponentialRampToValueAtTime(2093, now + 0.92)
  shimmerGain.gain.setValueAtTime(0.0001, now + 0.52)
  shimmerGain.gain.exponentialRampToValueAtTime(0.18, now + 0.58)
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.98)
  shimmer.connect(shimmerGain)
  shimmerGain.connect(masterGain)
  shimmer.start(now + 0.52)
  shimmer.stop(now + 1.02)
}

export const releaseMasterGain = (masterGain) => {
  window.setTimeout(() => {
    try {
      masterGain.disconnect()
    } catch (error) {
      console.warn('抽签音效资源释放失败', error)
    }
  }, 1300)
}
