<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ThreeLotteryStage from './ThreeLotteryStage.vue'
import { appVersion } from '../version'
import { 
  Upload, 
  Setting, 
  VideoPlay, 
  VideoPause, 
  Refresh, 
  Aim, 
  Download, 
  Delete,
  Close
} from '@element-plus/icons-vue'
import confetti from 'canvas-confetti'

// 存储输入的名单
const nameInput = ref('')
// 存储分割后的名单数组
const nameList = computed(() => {
  if (!nameInput.value) return []
  return nameInput.value
    .split('\n')
    .map(name => name.trim())
    .filter(name => name !== '')
})

const defaultBatchSize = 0
const fallbackMaxPickCount = 100

// 每批次抽取的人数
const batchSize = ref(defaultBatchSize)
// 输入框只限制一个宽松上限，真实可抽人数由开始抽签前的剩余名单校验兜住。
const maxPickCount = computed(() => Math.max(fallbackMaxPickCount, nameList.value.length, batchSize.value))
// 有效的最小抽取人数，默认 0 强制现场人员明确设置单批人数。
const minPickCount = computed(() => 0)
// 抽取结果
const pickedNames = ref([])
// 已抽取的所有人名（避免重复）
const allPickedNames = ref([])
// 当前批次
const currentBatch = ref(1)
// 总批次数
const totalBatches = ref(4)
// 是否正在抽取中
const isDrawing = ref(false)
// 是否处于揭晓动画阶段
const isRevealing = ref(false)
// 已经揭晓的卡片数量
const revealedCount = ref(0)
const droppingResultNames = ref([])
const isDroppingPreviousResult = ref(false)
const isThreeFinalBurst = ref(false)
// 控制面板抽屉显示状态
const drawerVisible = ref(false)
// 控制台默认落在准备页，让首次使用路径更短。
const activeSettingsTab = ref('prepare')
// 舞台视图模式，普通模式保证极端现场环境下仍有稳定兜底。
const stageMode = ref('grid')

// 计时器引用
let drawingTimer = null
let revealTimer = null
let droppingResultTimer = null
let threeFinalBurstTimer = null
let audioContext = null
let customAudioObjectUrl = ''
// 文件输入引用
const fileInputRef = ref(null)
const pendingQuickSetupAfterImport = ref(false)
const quickSetupVisible = ref(false)
const quickSetupBatchSize = ref(50)
const quickSetupTotalBatches = ref(4)
let quickSetupTimer = null
// 结束音效文件输入引用
const audioFileInputRef = ref(null)
// 历史记录
const historyRecords = ref([])
// 最终录入的幸运儿名单
const finalPickedNames = ref([])
// 自定义本地结束音效
const customAudioName = ref('')
const customAudioElement = ref(null)
const hasCustomResultSound = computed(() => Boolean(customAudioElement.value))
const resultSoundLabel = computed(() => customAudioName.value || '合成音效')

// 这些人数可以组成完整矩形网格，适合让姓名尽量吃满单元格横向空间。
const fullGridFillConfigs = {
  1: { columns: 1, preferredVw: 17 },
  2: { columns: 2, preferredVw: 12 },
  4: { columns: 2, preferredVw: 9 },
  8: { columns: 4, preferredVw: 7 },
  20: { columns: 5, preferredVw: 3.3 },
  40: { columns: 8, preferredVw: 2.25 },
  50: { columns: 10, preferredVw: 1.95 }
}

const getFullGridNameScale = (count, length) => {
  const config = fullGridFillConfigs[count]
  if (!config || length < 2) return null

  // 四字及以上按更宽的视觉占位处理，避免只按字符数放大导致溢出。
  const weightedLength = length >= 4 ? Math.min(length + 0.5, 6) : length === 2 ? 2.08 : 3
  const scale = 82 / (config.columns * config.preferredVw * weightedLength)

  return Math.min(2.45, Math.max(0.72, Number(scale.toFixed(2))))
}

const completedBatchCount = computed(() => Math.max(0, currentBatch.value - 1))
const remainingCount = computed(() => Math.max(0, nameList.value.length - allPickedNames.value.length))
const remainingNamesForStage = computed(() => nameList.value.filter(name => !allPickedNames.value.includes(name)))
const isThreeStage = computed(() => stageMode.value === 'three')
const showThreeStaticResult = computed(() => {
  return isThreeStage.value
    && pickedNames.value.length > 0
    && !isDrawing.value
    && !isDroppingPreviousResult.value
    && !isThreeFinalBurst.value
})
const showDroppingResult = computed(() => isThreeStage.value && isDroppingPreviousResult.value && droppingResultNames.value.length > 0)
const threeResultNames = computed(() => showDroppingResult.value ? droppingResultNames.value : pickedNames.value)
const canStartDraw = computed(() => {
  return nameList.value.length > 0
    && batchSize.value > 0
    && currentBatch.value <= totalBatches.value
    && remainingCount.value > 0
    && !isDrawing.value
})

const setStageMode = (mode) => {
  stageMode.value = mode
}

const readinessStatus = computed(() => {
  if (nameList.value.length === 0) return '先导入名单'
  if (batchSize.value <= 0) return '设置单批人数'
  if (remainingCount.value === 0) return '名单已抽完'
  if (currentBatch.value > totalBatches.value) return '轮数已完成'
  return '可以开始'
})

const setupSteps = computed(() => [
  {
    label: '导入名单',
    detail: nameList.value.length > 0 ? `${nameList.value.length} 人已进入奖池` : '粘贴名单或选择 TXT 文件',
    done: nameList.value.length > 0
  },
  {
    label: '确认人数',
    detail: batchSize.value > 0 ? `每轮抽取 ${batchSize.value} 人` : '设置每轮抽取人数',
    done: batchSize.value > 0
  },
  {
    label: '开始抽签',
    detail: canStartDraw.value ? '准备完成' : readinessStatus.value,
    done: canStartDraw.value
  }
])

const syncLocalizedAriaLabels = async () => {
  await nextTick()

  document.querySelectorAll('.tech-drawer .el-input-number__decrease').forEach((button) => {
    button.setAttribute('aria-label', '减少数字')
  })
  document.querySelectorAll('.tech-drawer .el-input-number__increase').forEach((button) => {
    button.setAttribute('aria-label', '增加数字')
  })
}

const openDrawer = async (tab = 'prepare') => {
  activeSettingsTab.value = tab
  drawerVisible.value = true
  await syncLocalizedAriaLabels()
}

const getGridStyleByCount = (count) => {
  if (count === 0) return {}
  
  let cols = 1
  let rows = 1
  
  if (count === 1) {
    cols = 1; rows = 1;
  } else if (count === 2) {
    cols = 2; rows = 1;
  } else if (count <= 4) {
    cols = 2; rows = 2;
  } else if (count <= 6) {
    cols = 3; rows = 2;
  } else if (count <= 8) {
    cols = 4; rows = 2;
  } else if (count <= 12) {
    cols = 4; rows = 3;
  } else if (count <= 16) {
    cols = 4; rows = 4;
  } else if (count <= 20) {
    cols = 5; rows = 4;
  } else if (count <= 25) {
    cols = 5; rows = 5;
  } else if (count <= 30) {
    cols = 6; rows = 5;
  } else if (count <= 36) {
    cols = 6; rows = 6;
  } else if (count === 40) {
    cols = 8; rows = 5;
  } else if (count <= 42) {
    cols = 7; rows = 6;
  } else if (count <= 49) {
    cols = 7; rows = 7;
  } else if (count === 50) {
    cols = 10; rows = 5;
  } else {
    // 50人以上，自动均衡排列
    cols = Math.ceil(Math.sqrt(count * 1.6))
    rows = Math.ceil(count / cols)
  }
  
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    gap: count <= 4 ? '22px' : count <= 12 ? '18px' : count <= 30 ? '12px' : '8px',
    width: '100%',
    height: '100%',
  }
}

// 动态计算网格的样式
const gridStyle = computed(() => getGridStyleByCount(pickedNames.value.length))
const threeResultGridStyle = computed(() => getGridStyleByCount(threeResultNames.value.length))

const getNameCardStyleByCount = (count) => {
  let fontSize = 'clamp(1.35rem, 2vw, 2.6rem)'
  let padding = '1rem'
  
  if (count === 1) {
    fontSize = 'clamp(8rem, 17vw, 22rem)'
    padding = '3rem'
  } else if (count === 2) {
    fontSize = 'clamp(6rem, 12vw, 16rem)'
    padding = '2.5rem'
  } else if (count <= 4) {
    fontSize = 'clamp(4.8rem, 9vw, 12rem)'
    padding = '2rem'
  } else if (count <= 8) {
    fontSize = 'clamp(4rem, 7vw, 9rem)'
    padding = '1.4rem'
  } else if (count <= 9) {
    fontSize = 'clamp(3.6rem, 6vw, 8rem)'
    padding = '1.2rem'
  } else if (count <= 12) {
    fontSize = 'clamp(3.1rem, 5vw, 6.8rem)'
    padding = '1rem'
  } else if (count <= 16) {
    fontSize = 'clamp(2.55rem, 4.25vw, 5.8rem)'
    padding = '0.9rem'
  } else if (count <= 25) {
    fontSize = 'clamp(2rem, 3.3vw, 4.5rem)'
    padding = '0.65rem'
  } else if (count <= 36) {
    fontSize = 'clamp(1.65rem, 2.65vw, 3.5rem)'
    padding = '0.55rem'
  } else if (count <= 49) {
    fontSize = 'clamp(1.45rem, 2.25vw, 3rem)'
    padding = '0.45rem'
  } else {
    // 50人及以上
    fontSize = 'clamp(1.35rem, 1.95vw, 2.6rem)'
    padding = '0.35rem'
  }
  
  return {
    fontSize,
    padding
  }
}

// 根据卡片总数计算基础字体大小与边距，优先保证 1 到 50 人在大屏上可读。
const nameCardStyle = computed(() => getNameCardStyleByCount(pickedNames.value.length))

// 针对不同字数名字做排版微调，保持视觉平衡
const getNameStyle = (name, count = pickedNames.value.length) => {
  if (!name) return {}
  const length = name.length
  const styles = { ...getNameCardStyleByCount(count) }
  const fullGridScale = getFullGridNameScale(count, length)

  if (fullGridScale) {
    styles.fontSize = `calc(${styles.fontSize} * ${fullGridScale})`
    return styles
  }
  
  if (length >= 4) {
    styles.fontSize = `calc(${styles.fontSize} * 0.74)`
  } else if (length === 3) {
    styles.fontSize = `calc(${styles.fontSize} * 0.9)`
  } else if (length === 2) {
    styles.fontSize = `calc(${styles.fontSize} * 1.02)`
  }
  
  return styles
}

// 自动调整抽取人数上限
const adjustPickCount = () => {
  const remaining = nameList.value.length - allPickedNames.value.length
  if (remaining > 0 && batchSize.value > remaining) {
    batchSize.value = remaining
  } else if (nameList.value.length > 0 && batchSize.value > nameList.value.length) {
    batchSize.value = nameList.value.length
  }
}

const resetAudioFileInput = () => {
  if (audioFileInputRef.value) {
    audioFileInputRef.value.value = ''
  }
}

const clearCustomResultSound = (showMessage = true) => {
  if (customAudioElement.value) {
    customAudioElement.value.pause()
    customAudioElement.value.removeAttribute('src')
    customAudioElement.value.load()
  }

  customAudioElement.value = null
  customAudioName.value = ''

  if (customAudioObjectUrl) {
    URL.revokeObjectURL(customAudioObjectUrl)
    customAudioObjectUrl = ''
  }

  resetAudioFileInput()

  if (showMessage) {
    ElMessage.success('已恢复合成音效')
  }
}

const isSupportedResultSoundFile = (file) => {
  const fileName = file.name.toLowerCase()
  const supportedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave']
  return supportedMimeTypes.includes(file.type) || fileName.endsWith('.mp3') || fileName.endsWith('.wav')
}

// 通过浏览器解码检查文件是否真能播放，避免只看扩展名导致现场无声。
const createValidatedAudioElement = (objectUrl) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    let settled = false

    const finish = (callback) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      callback()
    }

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('结束音效加载超时')))
    }, 5000)

    audio.preload = 'auto'
    audio.onloadedmetadata = () => {
      finish(() => resolve(audio))
    }
    audio.onerror = () => {
      finish(() => reject(new Error('结束音效无法播放')))
    }
    audio.src = objectUrl
    audio.load()
  })
}

const triggerAudioFileSelect = () => {
  audioFileInputRef.value?.click()
}

const handleAudioFileImport = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (!isSupportedResultSoundFile(file)) {
    ElMessage.error('请选择 MP3 或 WAV 音频文件')
    clearCustomResultSound(false)
    resetAudioFileInput()
    return
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const audio = await createValidatedAudioElement(objectUrl)
    clearCustomResultSound(false)
    customAudioObjectUrl = objectUrl
    customAudioElement.value = audio
    customAudioName.value = file.name
    ElMessage.success('已启用本地结束音效')
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    clearCustomResultSound(false)
    console.warn('本地结束音效加载失败', error)
    ElMessage.error('音频文件无法播放，已使用合成音效')
  } finally {
    resetAudioFileInput()
  }
}

const getAudioContext = () => {
  if (typeof window === 'undefined') return null

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass()
  }

  return audioContext
}

const prepareSynthResultSound = async () => {
  const context = getAudioContext()
  if (!context) return

  try {
    if (context.state === 'suspended') {
      await context.resume()
    }
  } catch (error) {
    console.warn('抽签音效初始化失败', error)
  }
}

const prepareCustomResultSound = async () => {
  const audio = customAudioElement.value
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

// 浏览器通常要求音频先由用户操作解锁，开始或停止抽签时先恢复音频资源。
const prepareResultSound = async () => {
  if (hasCustomResultSound.value) {
    await prepareCustomResultSound()
  }

  await prepareSynthResultSound()
}

const playCustomResultSound = async () => {
  const audio = customAudioElement.value
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

// 结束提示音使用 Web Audio 合成，避免额外引入音频文件和加载失败问题。
const playSynthResultSound = async () => {
  const context = getAudioContext()
  if (!context) return

  try {
    if (context.state === 'suspended') {
      await context.resume()
    }

    const now = context.currentTime
    const masterGain = context.createGain()
    const notes = [
      { frequency: 523.25, start: 0, duration: 0.18, volume: 0.28 },
      { frequency: 659.25, start: 0.12, duration: 0.2, volume: 0.3 },
      { frequency: 783.99, start: 0.24, duration: 0.22, volume: 0.32 },
      { frequency: 1046.5, start: 0.42, duration: 0.48, volume: 0.34 }
    ]

    masterGain.gain.setValueAtTime(0.0001, now)
    masterGain.gain.exponentialRampToValueAtTime(0.42, now + 0.03)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15)
    masterGain.connect(context.destination)

    notes.forEach((note) => {
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
    })

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

    window.setTimeout(() => {
      try {
        masterGain.disconnect()
      } catch (error) {
        console.warn('抽签音效资源释放失败', error)
      }
    }, 1300)
  } catch (error) {
    console.warn('播放抽签完成音效失败', error)
  }
}

const playDrawCompleteSound = async () => {
  const playedCustomSound = await playCustomResultSound()
  if (playedCustomSound) return

  if (hasCustomResultSound.value) {
    ElMessage.warning('本地音效播放失败，已使用合成音效')
  }

  await playSynthResultSound()
}

const previewResultSound = async () => {
  await prepareResultSound()
  await playDrawCompleteSound()
}

// 触发文件选择
const triggerFileSelect = (mode = 'drawer') => {
  pendingQuickSetupAfterImport.value = mode === 'three'
  fileInputRef.value?.click()
}

const openQuickSetupDialog = () => {
  quickSetupBatchSize.value = batchSize.value > 0 ? batchSize.value : Math.min(50, Math.max(1, nameList.value.length))
  quickSetupTotalBatches.value = totalBatches.value > 0 ? totalBatches.value : 4
  quickSetupVisible.value = true
  syncLocalizedAriaLabels()
}

const scheduleQuickSetupDialog = () => {
  if (!pendingQuickSetupAfterImport.value || !isThreeStage.value) return

  pendingQuickSetupAfterImport.value = false
  if (quickSetupTimer) window.clearTimeout(quickSetupTimer)
  quickSetupTimer = window.setTimeout(() => {
    openQuickSetupDialog()
    quickSetupTimer = null
  }, 2500)
}

const confirmQuickSetup = () => {
  const nextBatchSize = Number(quickSetupBatchSize.value)
  const nextTotalBatches = Number(quickSetupTotalBatches.value)

  if (!Number.isFinite(nextBatchSize) || nextBatchSize <= 0) {
    ElMessage.warning('每轮抽取人数必须大于 0')
    return
  }

  if (nextBatchSize > remainingCount.value) {
    ElMessage.warning(`剩余可抽人数为 ${remainingCount.value} 人，请调小每轮抽取人数`)
    return
  }

  if (!Number.isFinite(nextTotalBatches) || nextTotalBatches <= 0) {
    ElMessage.warning('抽取轮数必须大于 0')
    return
  }

  batchSize.value = nextBatchSize
  totalBatches.value = nextTotalBatches
  quickSetupVisible.value = false
  ElMessage.success('抽奖设置已就绪')
}

// 处理文本名单导入
const handleFileImport = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  if (!file.type.match('text.*') && !file.name.endsWith('.txt')) {
    ElMessage.error('请选择文本文件 (.txt)')
    event.target.value = ''
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      nameInput.value = e.target.result
      adjustPickCount()
      ElMessage.success(`成功导入名单，共 ${nameList.value.length} 人`)
      scheduleQuickSetupDialog()
    } catch (error) {
      ElMessage.error('导入失败，请检查文件格式')
    }
    event.target.value = ''
  }
  
  reader.onerror = () => {
    ElMessage.error('读取文件失败')
    event.target.value = ''
  }
  
  reader.readAsText(file)
}

// 开始抽签
const startDraw = () => {
  if (nameList.value.length === 0) {
    ElMessage.warning('请先导入或输入名单')
    return
  }
  
  const remainingNames = nameList.value.filter(name => !allPickedNames.value.includes(name))
  if (remainingNames.length === 0) {
    ElMessage.warning('所有人员已被抽取完毕')
    return
  }

  if (currentBatch.value > totalBatches.value) {
    ElMessage.warning('已达到设置的总抽取轮数，请调整总轮数或重置后再开始')
    return
  }
  
  if (batchSize.value <= 0) {
    ElMessage.warning('抽取人数必须大于 0')
    return
  }
  
  if (batchSize.value > remainingNames.length) {
    ElMessage.warning(`剩余可抽人数为 ${remainingNames.length} 人，请在设置中调整单批人数`)
    return
  }

  prepareResultSound()
  if (threeFinalBurstTimer) {
    window.clearTimeout(threeFinalBurstTimer)
    threeFinalBurstTimer = null
  }
  isThreeFinalBurst.value = false

  if (isThreeStage.value && pickedNames.value.length > 0 && !isDrawing.value) {
    droppingResultNames.value = [...pickedNames.value]
    isDroppingPreviousResult.value = true
    if (droppingResultTimer) window.clearTimeout(droppingResultTimer)
    droppingResultTimer = window.setTimeout(() => {
      isDroppingPreviousResult.value = false
      droppingResultNames.value = []
      droppingResultTimer = null
    }, 760)
  }
  
  isDrawing.value = true
  isRevealing.value = false
  revealedCount.value = 0
  
  if (drawingTimer) clearInterval(drawingTimer)
  if (revealTimer) clearInterval(revealTimer)
  
  // 滚动抽取动画：每 50ms 重新洗牌展示不重复的临时名单
  drawingTimer = setInterval(() => {
    const tempNames = []
    const tempCount = Math.min(batchSize.value, remainingNames.length)
    const pool = [...remainingNames]
    
    for (let i = 0; i < tempCount; i++) {
      if (pool.length === 0) break
      const randomIndex = Math.floor(Math.random() * pool.length)
      tempNames.push(pool.splice(randomIndex, 1)[0])
    }
    pickedNames.value = tempNames
  }, 50)
}

const finishDrawReveal = (finalNames) => {
  pickedNames.value = [...finalNames]
  allPickedNames.value = [...allPickedNames.value, ...finalNames]

  historyRecords.value.unshift({
    batch: currentBatch.value,
    names: finalNames,
  })

  currentBatch.value += 1

  const finishFeedback = () => {
    isDrawing.value = false
    isRevealing.value = false
    isThreeFinalBurst.value = false
    threeFinalBurstTimer = null

    ElMessage.success(`第 ${currentBatch.value - 1} 轮抽取完成，成功抽取 ${finalNames.length} 人`)
    playDrawCompleteSound()
    triggerConfetti()
  }

  if (!isThreeStage.value) {
    finishFeedback()
    return
  }

  isThreeFinalBurst.value = true
  if (threeFinalBurstTimer) window.clearTimeout(threeFinalBurstTimer)
  threeFinalBurstTimer = window.setTimeout(finishFeedback, 460)
}

// 停止抽取 (逐个揭晓动画)
const stopDraw = () => {
  if (!isDrawing.value || isRevealing.value) return

  prepareResultSound()
  
  isRevealing.value = true
  if (drawingTimer) clearInterval(drawingTimer)
  
  // 计算真实中奖名单
  const remainingNames = nameList.value.filter(name => !allPickedNames.value.includes(name))
  const namesCopy = [...remainingNames]
  
  // 洗牌算法
  for (let i = namesCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [namesCopy[i], namesCopy[j]] = [namesCopy[j], namesCopy[i]]
  }
  
  const finalNames = namesCopy.slice(0, Math.min(batchSize.value, namesCopy.length))
  finalPickedNames.value = finalNames
  
  revealedCount.value = 0
  const totalItems = finalNames.length
  
  // 每次揭晓步长，让总揭晓时间维持在 1.2s 左右
  const step = Math.max(1, Math.ceil(totalItems / 15))
  
  revealTimer = setInterval(() => {
    revealedCount.value += step
    
    if (revealedCount.value >= totalItems) {
      // 揭晓完成
      clearInterval(revealTimer)
      revealTimer = null
      finishDrawReveal(finalNames)
    } else {
      // 混合渲染：前面显示最终名单，后面继续随机滚动
      const currentList = []
      const usedFinalNames = finalNames.slice(0, revealedCount.value)
      const rollPool = remainingNames.filter(n => !usedFinalNames.includes(n))
      
      for (let i = 0; i < totalItems; i++) {
        if (i < revealedCount.value) {
          currentList.push(finalNames[i])
        } else {
          if (rollPool.length > 0) {
            const randomIndex = Math.floor(Math.random() * rollPool.length)
            currentList.push(rollPool.splice(randomIndex, 1)[0])
          } else {
            currentList.push('...')
          }
        }
      }
      pickedNames.value = currentList
    }
  }, 60)
}

// 科技感烟花：金、银、科技蓝、香槟金配色
const triggerConfetti = () => {
  const count = 300
  const defaults = {
    origin: { y: 0.65 },
    colors: ['#FFD700', '#FFA500', '#F4E0A5', '#C0C0C0', '#007AFF', '#5856D6']
  }

  const fire = (particleRatio, opts) => {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    })
  }

  fire(0.25, { spread: 26, startVelocity: 55 })
  fire(0.2, { spread: 60 })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  fire(0.1, { spread: 120, startVelocity: 45 })
}

// 重置大屏数据 (执行清空)
const clearResult = () => {
  pickedNames.value = []
  allPickedNames.value = []
  currentBatch.value = 1
  historyRecords.value = []
  finalPickedNames.value = []
  revealedCount.value = 0
  isDrawing.value = false
  isRevealing.value = false
  isDroppingPreviousResult.value = false
  isThreeFinalBurst.value = false
  droppingResultNames.value = []
  if (drawingTimer) clearInterval(drawingTimer)
  if (revealTimer) clearInterval(revealTimer)
  if (droppingResultTimer) window.clearTimeout(droppingResultTimer)
  if (threeFinalBurstTimer) window.clearTimeout(threeFinalBurstTimer)
  threeFinalBurstTimer = null
  ElMessage.success('数据重置成功')
}

// 重置二次安全确认
const handleResetConfirm = () => {
  ElMessageBox.confirm(
    '确定要重置所有已抽取的名单和历史记录吗？此操作将清空大屏数据且不可撤销，请在现场谨慎操作。',
    '重置二次确认',
    {
      confirmButtonText: '确定重置',
      cancelButtonText: '取消',
      type: 'warning',
      buttonSize: 'default',
      boxType: 'confirm',
      center: true
    }
  ).then(() => {
    clearResult()
  }).catch(() => {
    // 捕获取消，不做任何处理
  })
}

// 清空名单输入
const clearInput = () => {
  nameInput.value = ''
  clearResult()
}

// 导出历史数据 (.txt)
const exportHistory = () => {
  if (historyRecords.value.length === 0) {
    ElMessage.warning('暂无可以导出的历史记录')
    return
  }
  
  const orderedHistory = [...historyRecords.value].reverse()
  const content = orderedHistory.map(record => {
    return `第 ${record.batch} 轮抽取记录：\n${record.names.join('\n')}`
  }).join('\n\n')
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '抽签历史记录.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
  ElMessage.success('历史记录导出成功')
}

// 键盘快捷键监听
const handleKeyDown = (e) => {
  if (e.key === ' ' || e.code === 'Space') {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return
    }
    e.preventDefault()
    if (isDrawing.value) {
      stopDraw()
    } else {
      startDraw()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (drawingTimer) clearInterval(drawingTimer)
  if (revealTimer) clearInterval(revealTimer)
  if (droppingResultTimer) window.clearTimeout(droppingResultTimer)
  if (threeFinalBurstTimer) window.clearTimeout(threeFinalBurstTimer)
  clearCustomResultSound(false)
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch((error) => {
      console.warn('抽签音效上下文关闭失败', error)
    })
  }
})

const currentYear = computed(() => new Date().getFullYear())
</script>

<template>
  <div class="app-viewport">
    <input
      type="file"
      ref="fileInputRef"
      @change="handleFileImport"
      accept=".txt"
      aria-label="选择 TXT 名单文件"
      class="hidden-file-input"
    />

    <!-- 动态科技质感背景 -->
    <div class="dynamic-background">
      <div class="ambient-glow glow-1"></div>
      <div class="ambient-glow glow-2"></div>
      <div class="ambient-glow glow-3"></div>
    </div>

    <!-- 主界面区域 (垂直 Flex 布局，保证大底栏物理隔离不重合) -->
    <div class="main-layout">
      <!-- 名单展示核心区 (自适应填充剩余空间) -->
      <main class="grid-content-area">
        <div v-if="isThreeStage" class="grid-animation-wrapper is-three-stage">
          <ThreeLotteryStage
            v-if="!showThreeStaticResult"
            :names="pickedNames"
            :pool-names="remainingNamesForStage"
            :is-drawing="isDrawing"
            :is-revealing="isRevealing"
            :is-bursting="isThreeFinalBurst"
            :revealed-count="revealedCount"
            @import-list="triggerFileSelect('three')"
          />
          <div
            v-if="showThreeStaticResult || showDroppingResult"
            class="three-original-result-layer"
            :class="{ 'is-dropping': showDroppingResult }"
          >
            <div :style="threeResultGridStyle" class="interactive-grid">
              <div
                v-for="(name, index) in threeResultNames"
                :key="`three-result-${name}-${index}`"
                class="name-card-wrapper"
              >
                <div class="name-card is-revealed">
                  <span class="name-text" :style="getNameStyle(name, threeResultNames.length)">{{ name }}</span>
                  <div class="card-glow"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <template v-else>
          <!-- 空白状态下：直接呈现准备路径，避免首次使用者猜入口。 -->
          <div v-if="pickedNames.length === 0" class="empty-placeholder-container">
            <section class="center-dashboard-card" aria-labelledby="standby-title">
              <div class="standby-main">
                <div class="standby-kicker">现场准备</div>
                <h1 id="standby-title" class="dashboard-title">
                  {{ nameList.length > 0 ? '名单已就绪' : '抽签待开始' }}
                </h1>
                <p class="dashboard-subtitle">
                  {{ nameList.length > 0 ? `${nameList.length} 人进入奖池，确认单批人数后即可开始。` : '先导入名单，再确认每轮抽取人数。' }}
                </p>

                <div class="standby-actions" aria-label="抽签准备操作">
                  <el-button
                    type="primary"
                    class="standby-primary-btn"
                    @click="nameList.length === 0 ? openDrawer('prepare') : startDraw()"
                    :disabled="nameList.length > 0 && !canStartDraw"
                  >
                    <el-icon>
                      <Upload v-if="nameList.length === 0" />
                      <VideoPlay v-else />
                    </el-icon>
                    <span>{{ nameList.length === 0 ? '导入名单' : '开始抽签' }}</span>
                  </el-button>
                  <el-button class="standby-secondary-btn" @click="openDrawer('prepare')">
                    <el-icon><Setting /></el-icon>
                    <span>准备设置</span>
                  </el-button>
                </div>
              </div>

              <div class="setup-progress" aria-label="准备进度">
                <div
                  v-for="(step, index) in setupSteps"
                  :key="step.label"
                  class="setup-step"
                  :class="{ 'is-done': step.done, 'is-current': !step.done && setupSteps.slice(0, index).every(item => item.done) }"
                >
                  <span class="setup-step-index">{{ index + 1 }}</span>
                  <span class="setup-step-copy">
                    <span class="setup-step-label">{{ step.label }}</span>
                    <span class="setup-step-detail">{{ step.detail }}</span>
                  </span>
                </div>
              </div>

              <dl class="standby-metrics" aria-label="抽签状态概览">
                <div>
                  <dt>名单</dt>
                  <dd>{{ nameList.length }} 人</dd>
                </div>
                <div>
                  <dt>单批</dt>
                  <dd>{{ batchSize }} 人</dd>
                </div>
                <div>
                  <dt>剩余</dt>
                  <dd>{{ remainingCount }} 人</dd>
                </div>
                <div>
                  <dt>进度</dt>
                  <dd>{{ completedBatchCount }} / {{ totalBatches }} 轮</dd>
                </div>
              </dl>
            </section>
          </div>

          <!-- 抽签结果网格展示 -->
          <div v-else class="grid-animation-wrapper">
            <div :style="gridStyle" class="interactive-grid">
              <div
                v-for="(name, index) in pickedNames"
                :key="index"
                class="name-card-wrapper"
              >
                <div
                  class="name-card"
                  :class="{
                    'is-rolling': isDrawing && (!isRevealing || index >= revealedCount),
                    'is-revealed': !isDrawing || (isRevealing && index < revealedCount)
                  }"
                >
                  <!-- 名字再次加大，并使用特粗字体确保户外大屏易读性 -->
                  <span class="name-text" :style="getNameStyle(name)">{{ name }}</span>
                  <div class="card-glow"></div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </main>

      <!-- 底部控制与信息面板 (已精简收窄，高度及外边距大幅压缩，把空间彻底留给名字) -->
      <footer class="app-bottom-bar">
        <!-- 左侧：微型控制按钮组 (高度已缩减为 32px) -->
        <div class="bottom-bar-left">
          <template v-if="!isDrawing">
            <div class="stage-switcher" role="group" aria-label="舞台视图切换">
              <button
                type="button"
                class="stage-switch-btn"
                :class="{ 'is-active': stageMode === 'grid' }"
                @click="setStageMode('grid')"
              >
                普通
              </button>
              <button
                type="button"
                class="stage-switch-btn"
                :class="{ 'is-active': stageMode === 'three' }"
                @click="setStageMode('three')"
              >
                3D
              </button>
            </div>

            <el-button 
              class="icon-pill-btn"
              @click="openDrawer('prepare')"
            >
              <el-icon><Setting /></el-icon>
              <span>设置</span>
            </el-button>
            
            <el-button 
              type="primary"
              class="icon-pill-btn start-btn"
              @click="startDraw"
              :disabled="!canStartDraw"
            >
              <el-icon><VideoPlay /></el-icon>
              <span>开始</span>
            </el-button>
            
            <el-button 
              class="icon-pill-btn danger"
              @click="handleResetConfirm"
              :disabled="pickedNames.length === 0 && allPickedNames.length === 0"
            >
              <el-icon><Refresh /></el-icon>
              <span>重置</span>
            </el-button>
          </template>
          
          <template v-else>
            <div class="stage-switcher is-disabled" role="group" aria-label="舞台视图切换">
              <button
                type="button"
                class="stage-switch-btn"
                :class="{ 'is-active': stageMode === 'grid' }"
                disabled
              >
                普通
              </button>
              <button
                type="button"
                class="stage-switch-btn"
                :class="{ 'is-active': stageMode === 'three' }"
                disabled
              >
                3D
              </button>
            </div>

            <el-button
              class="icon-pill-btn"
              disabled
            >
              <el-icon><Setting /></el-icon>
              <span>设置</span>
            </el-button>

            <el-button 
              type="danger"
              class="icon-pill-btn stop-btn"
              @click="stopDraw"
              :disabled="isRevealing"
            >
              <el-icon class="pulse-icon"><VideoPause /></el-icon>
              <span>{{ isRevealing ? '正在揭晓...' : '停止' }}</span>
            </el-button>
          </template>
        </div>

        <!-- 中间：标注轮次和奖池信息，字号已收窄为 13px (抽签时暗化处理) -->
        <div class="bottom-bar-center" :class="{ 'dimmed-info': isDrawing }">
          <div class="bottom-stats-container">
            <span class="stat-capsule">进度 <span class="stat-highlight">{{ currentBatch - 1 }} / {{ totalBatches }}</span> 轮</span>
            <span class="stat-divider">·</span>
            <span class="stat-capsule">单批 <span class="stat-highlight">{{ batchSize }}</span> 人</span>
            <span class="stat-divider">·</span>
            <span class="stat-capsule">奖池剩余 <span class="stat-highlight">{{ remainingCount }} / {{ nameList.length }}</span> 人</span>
          </div>
        </div>

        <!-- 右侧：版权署名标注 (抽签时暗化处理) -->
        <div class="bottom-bar-right" :class="{ 'dimmed-info': isDrawing }">
          <span class="bottom-copyright">© {{ currentYear }} 信息科组小李 · 抽签系统 v{{ appVersion }}</span>
        </div>
      </footer>
    </div>

    <!-- 右侧高级设置面板 -->
    <el-drawer
      v-model="drawerVisible"
      title="抽签系统控制台"
      direction="rtl"
      size="min(520px, 100vw)"
      class="tech-drawer"
      :destroy-on-close="false"
      :show-close="false"
      @opened="syncLocalizedAriaLabels"
    >
      <template #header>
        <div class="drawer-custom-header">
          <div>
            <p class="drawer-eyebrow">抽签控制台</p>
            <h2>现场准备</h2>
          </div>
          <button class="drawer-close-btn" type="button" aria-label="关闭抽签控制台" @click="drawerVisible = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </template>
      <div class="drawer-layout-container">
        <el-tabs v-model="activeSettingsTab" class="drawer-tabs">
          <el-tab-pane name="prepare">
            <template #label>
              <span class="drawer-tab-label"><el-icon><Aim /></el-icon> 准备</span>
            </template>

            <div class="drawer-tab-panel">
              <section class="settings-section prep-summary-section">
                <div class="prep-summary">
                  <span class="prep-status">{{ readinessStatus }}</span>
                  <strong>{{ remainingCount }} / {{ nameList.length }}</strong>
                  <span>剩余可抽人数</span>
                </div>
                <p class="prep-helper">主持现场只需要先完成名单和单批人数，音效与历史记录可稍后处理。</p>
              </section>

              <section class="settings-section">
                <h3 class="section-title"><el-icon><Setting /></el-icon> 抽签基本设置</h3>
                <div class="settings-form">
                  <div class="form-row">
                    <div class="form-item half">
                      <label for="batch-size-input">单批抽取人数</label>
                      <el-input-number
                        id="batch-size-input"
                        v-model="batchSize"
                        :min="minPickCount"
                        :max="maxPickCount"
                        aria-label="单批抽取人数"
                        class="w-full"
                      />
                    </div>
                    <div class="form-item half">
                      <label for="total-batches-input">总抽取轮数</label>
                      <el-input-number
                        id="total-batches-input"
                        v-model="totalBatches"
                        :min="1"
                        :max="100"
                        aria-label="总抽取轮数"
                        class="w-full"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section class="settings-section">
                <div class="section-header-flex">
                  <h3 class="section-title"><el-icon><Aim /></el-icon> 名单管理</h3>
                  <div class="header-action-group">
                    <el-button type="primary" size="small" @click="triggerFileSelect" :disabled="isDrawing">
                      <el-icon><Upload /></el-icon> 导入
                    </el-button>
                    <el-button type="danger" size="small" @click="clearInput" :disabled="isDrawing" plain>
                      <el-icon><Delete /></el-icon> 清空
                    </el-button>
                  </div>
                </div>

                <el-input
                  v-model="nameInput"
                  type="textarea"
                  :rows="10"
                  placeholder="请输入名单，每行一个名字。也可以点击导入选择 TXT 文件。"
                  :disabled="isDrawing"
                  class="name-list-textarea"
                />

                <div class="inline-stat-list" aria-label="名单统计">
                  <span>名单 {{ nameList.length }} 人</span>
                  <span>已抽 {{ allPickedNames.length }} 人</span>
                  <span>剩余 {{ remainingCount }} 人</span>
                </div>
              </section>
            </div>
          </el-tab-pane>

          <el-tab-pane name="sound">
            <template #label>
              <span class="drawer-tab-label"><el-icon><VideoPlay /></el-icon> 音效</span>
            </template>

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
                    <el-button size="small" type="primary" @click="triggerAudioFileSelect" :disabled="isDrawing">
                      <el-icon><Upload /></el-icon> 选择音频
                    </el-button>
                    <input
                      type="file"
                      ref="audioFileInputRef"
                      @change="handleAudioFileImport"
                      accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
                      aria-label="选择 MP3 或 WAV 结束音效文件"
                      style="display: none"
                    />
                    <el-button size="small" @click="previewResultSound" :disabled="isDrawing">
                      <el-icon><VideoPlay /></el-icon> 试听
                    </el-button>
                    <el-button size="small" @click="clearCustomResultSound" :disabled="isDrawing || !hasCustomResultSound">
                      <el-icon><Refresh /></el-icon> 合成音
                    </el-button>
                  </div>
                </div>
              </section>
            </div>
          </el-tab-pane>

          <el-tab-pane name="records">
            <template #label>
              <span class="drawer-tab-label"><el-icon><Download /></el-icon> 记录</span>
            </template>

            <div class="drawer-tab-panel records-panel">
              <section class="settings-section">
                <h3 class="section-title"><el-icon><Refresh /></el-icon> 数据导出与重置</h3>
                <div class="action-grid-buttons">
                  <el-button type="success" class="action-btn-wide" @click="exportHistory" :disabled="historyRecords.length === 0">
                    <el-icon><Download /></el-icon> 导出历史记录
                  </el-button>
                  <el-button type="danger" class="action-btn-wide" @click="handleResetConfirm" :disabled="isDrawing" plain>
                    <el-icon><Refresh /></el-icon> 重置所有抽签数据
                  </el-button>
                </div>
              </section>

              <section class="settings-section flex-column-fill">
                <h3 class="section-title"><el-icon><VideoPlay /></el-icon> 历史抽取记录</h3>
                <div class="drawer-history-list">
                  <div v-if="historyRecords.length === 0" class="empty-history-placeholder">
                    暂无历史抽取记录
                  </div>
                  <div v-else class="history-list-cards">
                    <div v-for="record in historyRecords" :key="record.batch" class="history-record-card">
                      <div class="history-record-card-header">
                        <span class="record-batch-badge">第 {{ record.batch }} 轮</span>
                        <span class="record-count-badge">抽取 {{ record.names.length }} 人</span>
                      </div>
                      <div class="history-record-card-names">
                        <span v-for="(name, idx) in record.names" :key="idx" class="history-name-tag">
                          {{ name }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </el-tab-pane>
        </el-tabs>
        
        <!-- 页脚 -->
        <footer class="drawer-footer-copyright">
          <span>© {{ currentYear }} 信息科组小李 · 抽签系统 v{{ appVersion }}</span>
        </footer>
      </div>
    </el-drawer>

    <el-dialog
      v-model="quickSetupVisible"
      title="抽奖设置"
      width="min(420px, calc(100vw - 32px))"
      class="quick-setup-dialog"
      :close-on-click-modal="false"
      :show-close="false"
      align-center
      @opened="syncLocalizedAriaLabels"
    >
      <div class="quick-setup-body">
        <p class="quick-setup-copy">名单已进入 3D 舞台，确认每轮抽取人数和总轮数后即可开始。</p>
        <div class="quick-setup-grid">
          <label class="quick-setup-field" for="quick-batch-size-input">
            <span>每轮抽取</span>
            <el-input-number
              id="quick-batch-size-input"
              v-model="quickSetupBatchSize"
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
              v-model="quickSetupTotalBatches"
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
          <el-button @click="quickSetupVisible = false">稍后设置</el-button>
          <el-button type="primary" @click="confirmQuickSetup">确认</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 核心视口与字体设定 */
.app-viewport {
  --color-ink: oklch(23% 0.028 252);
  --color-ink-soft: oklch(38% 0.026 252);
  --color-muted: oklch(52% 0.026 252);
  --color-surface: oklch(98% 0.012 248);
  --color-surface-strong: oklch(99% 0.008 248);
  --color-surface-warm: oklch(96% 0.018 248);
  --color-line: oklch(73% 0.035 248 / 0.28);
  --color-line-strong: oklch(62% 0.05 248 / 0.34);
  --color-primary: oklch(56% 0.17 255);
  --color-primary-deep: oklch(47% 0.16 255);
  --color-primary-soft: oklch(94% 0.04 255);
  --color-sky: oklch(63% 0.12 205);
  --color-sky-deep: oklch(49% 0.1 205);
  --color-sky-soft: oklch(95% 0.035 205);
  --color-jade: oklch(56% 0.105 166);
  --color-danger: oklch(48% 0.18 28);
  --color-danger-soft: oklch(93% 0.052 28);
  --shadow-soft: 0 20px 56px oklch(28% 0.05 252 / 0.12);
  --shadow-panel: 0 10px 28px oklch(28% 0.04 252 / 0.08);
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--color-ink);
}

:deep(.el-button--primary) {
  --el-button-bg-color: var(--color-primary);
  --el-button-border-color: var(--color-primary);
  --el-button-hover-bg-color: oklch(61% 0.17 255);
  --el-button-hover-border-color: oklch(61% 0.17 255);
  --el-button-active-bg-color: var(--color-primary-deep);
  --el-button-active-border-color: var(--color-primary-deep);
}

:deep(.el-button--success) {
  --el-button-bg-color: var(--color-jade);
  --el-button-border-color: var(--color-jade);
  --el-button-hover-bg-color: oklch(59% 0.1 160);
  --el-button-hover-border-color: oklch(59% 0.1 160);
}

:deep(.el-button--danger) {
  --el-button-bg-color: var(--color-danger);
  --el-button-border-color: var(--color-danger);
  --el-button-hover-bg-color: oklch(53% 0.18 28);
  --el-button-hover-border-color: oklch(53% 0.18 28);
}

:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  color: var(--color-ink-soft);
}

/* 浅色大屏背景：冷白底和弱网格保持清爽，不影响姓名可读性。 */
.dynamic-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    linear-gradient(oklch(62% 0.035 248 / 0.1) 1px, transparent 1px),
    linear-gradient(90deg, oklch(62% 0.035 248 / 0.1) 1px, transparent 1px),
    linear-gradient(120deg, oklch(72% 0.12 255 / 0.13), transparent 42%),
    linear-gradient(300deg, oklch(70% 0.09 166 / 0.09), transparent 38%),
    var(--color-surface);
  background-size: 44px 44px, 44px 44px, 100% 100%, 100% 100%, auto;
  overflow: hidden;
  z-index: 0;
}

.dynamic-background::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 0%, oklch(72% 0.12 255 / 0.16) 48%, transparent 52%),
    linear-gradient(180deg, oklch(99% 0.008 248 / 0.72), transparent 30%, oklch(98% 0.012 248 / 0.78));
  opacity: 0.72;
  pointer-events: none;
}

.ambient-glow {
  position: absolute;
  border-radius: 0;
  filter: none;
  opacity: 1;
  mix-blend-mode: normal;
  pointer-events: none;
}

.glow-1 {
  width: 100%;
  height: 2px;
  top: 72px;
  left: 0;
  background: linear-gradient(90deg, transparent, oklch(67% 0.14 255 / 0.52), transparent);
}

.glow-2 {
  width: 100%;
  height: 34%;
  bottom: 0;
  right: 0;
  background: linear-gradient(180deg, transparent, oklch(94% 0.026 248 / 0.86));
}

.glow-3 {
  width: 34%;
  height: 100%;
  top: 0;
  right: 7%;
  background: linear-gradient(90deg, transparent, oklch(70% 0.09 166 / 0.08), transparent);
}

@keyframes floatAmbient {
  0% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    transform: translate(8%, 10%) scale(1.1);
  }
}

/* 页面主要骨架 - 保持纵向独立比例 */
.main-layout {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 12px;
  box-sizing: border-box;
}

/* 展示大区 */
.grid-content-area {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
}

.empty-placeholder-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 首次进入用准备台承接导入、人数、开始三步。 */
.center-dashboard-card {
  width: min(860px, calc(100vw - 48px));
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
  gap: 32px;
  align-items: stretch;
  padding: 42px;
  border-radius: 12px;
  border: 1px solid var(--color-line);
  background:
    linear-gradient(135deg, oklch(99% 0.01 248 / 0.96), oklch(96% 0.022 248 / 0.9)),
    var(--color-surface-strong);
  box-shadow: var(--shadow-soft), inset 0 1px 0 oklch(100% 0 0 / 0.72);
  animation: zoomFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes zoomFadeIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.standby-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.standby-kicker {
  width: fit-content;
  margin-bottom: 14px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary-deep);
  font-size: 12px;
  line-height: 1;
  font-weight: 800;
}

.dashboard-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.12;
  font-weight: 900;
  color: var(--color-ink);
  letter-spacing: 0;
}

.dashboard-subtitle {
  max-width: 36rem;
  margin: 12px 0 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-muted);
  font-weight: 600;
}

.standby-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.standby-primary-btn,
.standby-secondary-btn {
  height: 42px !important;
  border-radius: 8px !important;
  padding: 0 18px !important;
  font-weight: 800 !important;
}

.standby-primary-btn {
  background: linear-gradient(180deg, var(--color-primary), var(--color-primary-deep)) !important;
  border: none !important;
  box-shadow: 0 12px 26px oklch(47% 0.16 255 / 0.22) !important;
}

.standby-secondary-btn {
  background: oklch(99% 0.008 82 / 0.72) !important;
  border: 1px solid var(--color-line) !important;
  color: var(--color-ink-soft) !important;
}

.setup-progress {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.setup-step {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 12px;
  align-items: center;
  min-height: 54px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-line);
  background: oklch(99% 0.008 82 / 0.5);
}

.setup-step.is-current {
  border-color: oklch(63% 0.12 205 / 0.42);
  background: var(--color-sky-soft);
}

.setup-step.is-done {
  border-color: oklch(54% 0.095 160 / 0.36);
  background: oklch(94% 0.048 154 / 0.58);
}

.setup-step-index {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--color-surface-warm);
  color: var(--color-ink);
  font-size: 13px;
  font-weight: 900;
}

.setup-step.is-done .setup-step-index {
  background: var(--color-jade);
  color: var(--color-surface-strong);
}

.setup-step-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.setup-step-label {
  font-size: 14px;
  font-weight: 850;
  color: var(--color-ink);
}

.setup-step-detail {
  font-size: 12px;
  line-height: 1.35;
  color: var(--color-muted);
  font-weight: 650;
}

.standby-metrics {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: var(--color-line);
}

.standby-metrics div {
  padding: 14px 16px;
  background: oklch(99% 0.008 82 / 0.62);
}

.standby-metrics dt {
  margin: 0 0 5px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 750;
}

.standby-metrics dd {
  margin: 0;
  color: var(--color-ink);
  font-size: 18px;
  font-weight: 900;
}

.grid-animation-wrapper {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 4px 0;
}

.grid-animation-wrapper.is-three-stage {
  padding: 0;
  position: relative;
}

.interactive-grid {
  width: 100%;
  height: 100%;
}

.three-original-result-layer {
  position: absolute;
  inset: 0;
  z-index: 8;
  box-sizing: border-box;
  padding: 4px 0;
  background: transparent;
}

.three-original-result-layer.is-dropping {
  pointer-events: none;
  animation: resultGridDropOut 0.74s cubic-bezier(0.72, 0, 0.8, 0.32) forwards;
}

@keyframes resultGridDropOut {
  0% {
    transform: translateY(0);
    opacity: 1;
    filter: blur(0);
  }
  100% {
    transform: translateY(105%);
    opacity: 0;
    filter: blur(1.5px);
  }
}

.name-card-wrapper {
  width: 100%;
  height: 100%;
  perspective: 1000px;
}

/* 核心抽签名字卡片 */
.name-card {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background:
    linear-gradient(180deg, oklch(99% 0.008 248 / 0.98), oklch(96% 0.02 248 / 0.94));
  border: 1px solid var(--color-line);
  box-shadow: var(--shadow-panel), inset 0 1px 0 oklch(100% 0 0 / 0.72);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.24s ease, box-shadow 0.24s ease;
}

.name-card::before {
  content: '';
  position: absolute;
  inset: 7px;
  border: 1px solid oklch(72% 0.12 255 / 0.16);
  border-radius: 5px;
  pointer-events: none;
}

/* 滚动抽签状态 */
.name-card.is-rolling {
  transform: scale(0.985);
  background:
    linear-gradient(180deg, oklch(99% 0.012 248 / 0.98), oklch(94% 0.04 255 / 0.96));
  border-color: oklch(61% 0.17 255 / 0.54);
  box-shadow: 0 0 0 1px oklch(72% 0.12 255 / 0.2), 0 14px 32px oklch(47% 0.16 255 / 0.14);
}

.name-card.is-rolling .name-text {
  filter: blur(0.3px);
  opacity: 0.9;
  color: var(--color-primary-deep);
}

/* 揭晓锁定状态 */
.name-card.is-revealed {
  animation: revealSpring 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  background:
    linear-gradient(180deg, oklch(99% 0.012 248 / 0.98), oklch(95% 0.04 166 / 0.92));
  border-color: oklch(56% 0.105 166 / 0.55);
  box-shadow: 0 0 0 1px oklch(56% 0.105 166 / 0.2), 0 16px 36px oklch(38% 0.06 180 / 0.12), inset 0 1px 0 oklch(100% 0 0 / 0.76);
}

.name-card.is-revealed .name-text {
  color: var(--color-ink);
  font-weight: 900;
  text-shadow: 0 1px 0 oklch(100% 0 0 / 0.64);
}

/* 顶部状态线用于提示揭晓完成，不抢人名。 */
.name-card.is-revealed::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-sky), var(--color-jade));
  opacity: 0.92;
}

@keyframes revealSpring {
  0% {
    transform: scale(0.8) translateY(12px);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.name-text {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro SC", "SF Pro Text", "PingFang SC", sans-serif;
  text-align: center;
  transition: color 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
  white-space: nowrap;
  line-height: 1;
  letter-spacing: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  z-index: 2;
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(135deg, oklch(100% 0 0 / 0.48) 0%, transparent 54%);
  z-index: 1;
}

/* 一体化底部控制信息栏，尽量少占大屏名字空间。 */
.app-bottom-bar {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  background: oklch(99% 0.008 82 / 0.9);
  border: 1px solid var(--color-line);
  box-shadow: 0 10px 28px oklch(28% 0.04 48 / 0.08), inset 0 1px 0 oklch(100% 0 0 / 0.72);
  border-radius: 8px;
  z-index: 10;
  box-sizing: border-box;
  margin-top: 8px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 左侧：按钮区域 */
.bottom-bar-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.stage-switcher {
  height: 30px;
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(48px, 1fr));
  align-items: center;
  padding: 2px;
  border-radius: 7px;
  border: 1px solid var(--color-line);
  background: oklch(95% 0.016 248 / 0.8);
  flex-shrink: 0;
}

.stage-switcher.is-disabled {
  opacity: 0.48;
  pointer-events: none;
}

.stage-switch-btn {
  height: 24px;
  min-width: 48px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.stage-switch-btn:hover {
  color: var(--color-primary-deep);
}

.stage-switch-btn.is-active {
  background: var(--color-surface-strong);
  color: var(--color-primary-deep);
  box-shadow: 0 4px 12px oklch(38% 0.04 248 / 0.1);
}

.icon-pill-btn {
  border-radius: 7px !important;
  font-weight: 600 !important;
  height: 30px !important;
  padding: 0 12px !important;
  font-size: 13px !important;
  border: 1px solid var(--color-line) !important;
  background: oklch(99% 0.008 82 / 0.82) !important;
  color: var(--color-ink) !important;
  box-shadow: none !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.icon-pill-btn:hover {
  background: var(--color-surface-strong) !important;
  transform: translateY(-1px);
}

.icon-pill-btn.start-btn {
  background: linear-gradient(180deg, var(--color-primary), var(--color-primary-deep)) !important;
  color: var(--color-surface-strong) !important;
  border: none !important;
  box-shadow: 0 7px 18px oklch(47% 0.16 255 / 0.2) !important;
}

.icon-pill-btn.start-btn:hover {
  box-shadow: 0 9px 22px oklch(47% 0.16 255 / 0.26) !important;
}

.icon-pill-btn.stop-btn {
  background: linear-gradient(180deg, var(--color-danger), oklch(39% 0.16 27)) !important;
  color: var(--color-surface-strong) !important;
  border: none !important;
  box-shadow: 0 4px 10px oklch(39% 0.16 27 / 0.18) !important;
  animation: pulseGlowBtn 1.5s infinite;
}

@keyframes pulseGlowBtn {
  0% { transform: scale(1); box-shadow: 0 4px 10px oklch(39% 0.16 27 / 0.18); }
  50% { transform: scale(1.02); box-shadow: 0 7px 16px oklch(39% 0.16 27 / 0.28); }
  100% { transform: scale(1); box-shadow: 0 4px 10px oklch(39% 0.16 27 / 0.18); }
}

.icon-pill-btn.danger {
  color: var(--color-danger) !important;
}

.icon-pill-btn.danger:hover {
  background: var(--color-danger-soft) !important;
  border-color: oklch(48% 0.18 28 / 0.2) !important;
}

.icon-pill-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  background: oklch(88% 0.012 248 / 0.56) !important;
  color: oklch(50% 0.018 58 / 0.52) !important;
  border: 1px solid oklch(58% 0.018 58 / 0.12) !important;
}

.pulse-icon {
  animation: spinPulse 1s infinite linear;
}

@keyframes spinPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* 中间：信息标注区域 (字号和间距已缩窄) */
.bottom-bar-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 2;
  transition: all 0.3s ease;
}

.bottom-bar-center.dimmed-info {
  opacity: 0.35;
}

.bottom-stats-container {
  display: flex;
  align-items: center;
  gap: 10px; /* 间距缩减 */
  font-size: 13px;
  font-weight: 700;
  color: var(--color-muted);
}

.stat-capsule {
  color: var(--color-muted);
}

.stat-highlight {
  color: var(--color-ink);
  font-weight: 800;
}

.stat-divider {
  color: oklch(43% 0.03 48 / 0.22);
  font-size: 14px;
}

/* 右侧：版权标注区域 (字号弱化) */
.bottom-bar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  transition: all 0.3s ease;
}

.bottom-bar-right.dimmed-info {
  opacity: 0.35;
}

.bottom-copyright {
  font-size: 12px;
  font-weight: 600;
  color: oklch(38% 0.032 45 / 0.5);
  letter-spacing: 0;
  white-space: nowrap;
}

/* 右侧高级设置面板抽屉 */
:deep(.tech-drawer) {
  background-color: var(--color-surface) !important;
}

:deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 24px 24px 14px;
  border-bottom: 1px solid var(--color-line);
}

:deep(.el-drawer__title) {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-ink);
}

:deep(.el-drawer__body) {
  padding: 0 24px 20px;
}

.drawer-custom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.drawer-eyebrow {
  margin: 0 0 4px;
  color: var(--color-primary-deep);
  font-size: 12px;
  font-weight: 850;
}

.drawer-custom-header h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: 22px;
  line-height: 1.2;
  font-weight: 900;
}

.drawer-close-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-strong);
  color: var(--color-ink-soft);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.drawer-close-btn:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-deep);
  transform: translateY(-1px);
}

.drawer-layout-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-tabs {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.drawer-tabs :deep(.el-tabs__header) {
  order: -1;
  margin: 0 0 18px;
}

.drawer-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--color-line);
}

.drawer-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--color-primary);
}

.drawer-tabs :deep(.el-tabs__item) {
  color: var(--color-muted);
  font-weight: 750;
}

.drawer-tabs :deep(.el-tabs__item.is-active),
.drawer-tabs :deep(.el-tabs__item:hover) {
  color: var(--color-primary-deep);
}

.drawer-tabs :deep(.el-tabs__content) {
  order: 0;
  flex: 1;
  min-height: 0;
}

.drawer-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.drawer-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.drawer-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  min-height: 0;
}

.records-panel {
  min-height: 0;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prep-summary-section {
  gap: 10px;
}

.prep-summary {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 16px;
  align-items: end;
  padding: 16px;
  border: 1px solid oklch(63% 0.12 205 / 0.3);
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-sky-soft), oklch(99% 0.01 248 / 0.82));
}

.prep-summary strong {
  grid-row: span 2;
  color: var(--color-ink);
  font-size: 30px;
  line-height: 1;
  font-weight: 950;
}

.prep-summary span {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 750;
}

.prep-summary .prep-status {
  color: var(--color-primary-deep);
  font-size: 14px;
  font-weight: 900;
}

.prep-helper {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.55;
  font-weight: 650;
}

.settings-section.flex-column-fill {
  flex: 1;
  min-height: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-ink-soft);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  letter-spacing: 0.03em;
}

.section-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-action-group {
  display: flex;
  gap: 8px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-ink);
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-item.half {
  flex: 1;
}

.name-list-textarea :deep(.el-textarea__inner) {
  border-radius: 10px;
  font-family: monospace;
  font-size: 13px;
  border-color: var(--color-line);
  background: var(--color-surface-strong);
  padding: 12px;
  transition: all 0.3s;
}

.name-list-textarea :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 3px oklch(56% 0.17 255 / 0.16);
  border-color: var(--color-primary);
}

.inline-stat-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.inline-stat-list span {
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid var(--color-line);
  background: var(--color-surface-warm);
  font-size: 13px;
  font-weight: 750;
  color: var(--color-ink-soft);
}

/* 结束音效设置 */
.sound-panel-box {
  background: var(--color-surface-warm);
  border: 1px solid var(--color-line);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sound-current-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sound-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-ink-soft);
  flex-shrink: 0;
}

.sound-name {
  min-width: 0;
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--color-surface-strong);
  border: 1px solid var(--color-line);
  color: var(--color-ink);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.sound-name.is-custom {
  color: var(--color-primary-deep);
  background: var(--color-primary-soft);
  border-color: oklch(56% 0.17 255 / 0.18);
}

.sound-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 操作区域 */
.action-grid-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.action-btn-wide {
  border-radius: 10px !important;
  font-weight: 600 !important;
  height: 38px !important;
}

/* 抽屉内历史记录 */
.drawer-history-list {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-line);
  background: var(--color-surface-strong);
  border-radius: 10px;
  overflow-y: auto;
  padding: 14px;
}

.empty-history-placeholder {
  text-align: center;
  color: var(--color-muted);
  font-size: 13px;
  padding: 40px 0;
}

.history-list-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-record-card {
  border-bottom: 1px solid var(--color-line);
  padding-bottom: 12px;
}

.history-record-card:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.history-record-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.record-batch-badge {
  font-size: 12px;
  font-weight: 700;
  background: var(--color-ink);
  color: var(--color-surface-strong);
  padding: 2px 8px;
  border-radius: 6px;
}

.record-count-badge {
  font-size: 11px;
  color: var(--color-muted);
  font-weight: 600;
}

.history-record-card-names {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.history-name-tag {
  background: var(--color-surface-warm);
  border: 1px solid var(--color-line);
  color: var(--color-ink-soft);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.drawer-footer-copyright {
  text-align: center;
  font-size: 11px;
  color: var(--color-muted);
  border-top: 1px solid var(--color-line);
  padding-top: 16px;
}

.hidden-file-input {
  display: none;
}

.quick-setup-dialog :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-surface-strong);
}

.quick-setup-dialog :deep(.el-dialog__header) {
  padding: 22px 22px 10px;
  margin: 0;
}

.quick-setup-dialog :deep(.el-dialog__title) {
  color: var(--color-ink);
  font-size: 20px;
  font-weight: 900;
}

.quick-setup-dialog :deep(.el-dialog__body) {
  padding: 10px 22px 18px;
}

.quick-setup-dialog :deep(.el-dialog__footer) {
  padding: 0 22px 22px;
}

.quick-setup-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-setup-copy {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.55;
  font-weight: 700;
}

.quick-setup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.quick-setup-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-ink-soft);
}

.quick-setup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 针对 Element Plus 组件的部分覆盖适配 */
.w-full {
  width: 100%;
}

@media (max-width: 980px) {
  .center-dashboard-card {
    width: min(680px, calc(100vw - 36px));
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 32px;
  }

  .standby-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .app-bottom-bar {
    height: auto;
    min-height: 42px;
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 8px 12px;
  }

  .bottom-bar-left,
  .bottom-bar-center {
    flex: 1 1 auto;
  }

  .bottom-bar-right {
    display: none;
  }
}

@media (max-width: 640px) {
  .main-layout {
    padding: 10px;
  }

  .center-dashboard-card {
    width: 100%;
    max-height: calc(100vh - 126px);
    overflow-y: auto;
    padding: 18px;
    gap: 16px;
  }

  .dashboard-title {
    font-size: 26px;
  }

  .dashboard-subtitle {
    margin-top: 8px;
    font-size: 13px;
  }

  .standby-actions {
    flex-direction: column;
    gap: 8px;
    margin-top: 18px;
  }

  .standby-primary-btn,
  .standby-secondary-btn {
    width: 100%;
    height: 38px !important;
  }

  .setup-progress {
    gap: 8px;
  }

  .setup-step {
    min-height: 44px;
    padding: 8px 10px;
  }

  .standby-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .standby-metrics div {
    padding: 10px 12px;
  }

  .bottom-stats-container {
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 8px;
    font-size: 12px;
  }

  .form-row,
  .action-grid-buttons {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
