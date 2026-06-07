<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Upload, 
  Setting, 
  VideoPlay, 
  VideoPause, 
  Refresh, 
  Aim, 
  Download, 
  Delete 
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
// 控制面板抽屉显示状态
const drawerVisible = ref(false)

// 计时器引用
let drawingTimer = null
let revealTimer = null
let audioContext = null
let customAudioObjectUrl = ''
// 文件输入引用
const fileInputRef = ref(null)
// 结束音效文件输入引用
const audioFileInputRef = ref(null)
// 历史记录
const historyRecords = ref([])
// 最终录入的幸运儿名单
const finalPickedNames = ref([])
// 自定义 MP3 结束音效
const customAudioName = ref('')
const customAudioElement = ref(null)
const hasCustomResultSound = computed(() => Boolean(customAudioElement.value))
const resultSoundLabel = computed(() => customAudioName.value || '合成音效')

// 动态计算网格的样式
const gridStyle = computed(() => {
  const count = pickedNames.value.length
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
})

// 根据卡片总数计算基础字体大小与边距，优先保证 1 到 50 人在大屏上可读。
const nameCardStyle = computed(() => {
  const count = pickedNames.value.length
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
})

// 针对不同字数名字做排版微调，保持视觉平衡
const getNameStyle = (name) => {
  if (!name) return {}
  const length = name.length
  const styles = { ...nameCardStyle.value }
  
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

const isMp3File = (file) => {
  return file.type === 'audio/mpeg' || file.type === 'audio/mp3' || file.name.toLowerCase().endsWith('.mp3')
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
      finish(() => reject(new Error('MP3 音效加载超时')))
    }, 5000)

    audio.preload = 'auto'
    audio.onloadedmetadata = () => {
      finish(() => resolve(audio))
    }
    audio.onerror = () => {
      finish(() => reject(new Error('MP3 音效无法播放')))
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

  if (!isMp3File(file)) {
    ElMessage.error('请选择 MP3 音频文件')
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
    ElMessage.success('已启用 MP3 结束音效')
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    clearCustomResultSound(false)
    console.warn('MP3 结束音效加载失败', error)
    ElMessage.error('MP3 文件无法播放，已使用合成音效')
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
    console.warn('MP3 结束音效初始化失败', error)
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
    console.warn('播放 MP3 结束音效失败', error)
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
    ElMessage.warning('MP3 音效播放失败，已使用合成音效')
  }

  await playSynthResultSound()
}

const previewResultSound = async () => {
  await prepareResultSound()
  await playDrawCompleteSound()
}

// 触发文件选择
const triggerFileSelect = () => {
  fileInputRef.value.click()
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
  
  if (batchSize.value <= 0) {
    ElMessage.warning('抽取人数必须大于 0')
    return
  }
  
  if (batchSize.value > remainingNames.length) {
    ElMessage.warning(`剩余可抽人数为 ${remainingNames.length} 人，请在设置中调整单批人数`)
    return
  }

  prepareResultSound()
  
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
      pickedNames.value = [...finalNames]
      
      allPickedNames.value = [...allPickedNames.value, ...finalNames]
      
      historyRecords.value.unshift({
        batch: currentBatch.value,
        names: finalNames,
      })
      
      currentBatch.value += 1
      isDrawing.value = false
      isRevealing.value = false
      
      ElMessage.success(`第 ${currentBatch.value - 1} 轮抽取完成，成功抽取 ${finalNames.length} 人`)
      playDrawCompleteSound()
      triggerConfetti()
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
  if (drawingTimer) clearInterval(drawingTimer)
  if (revealTimer) clearInterval(revealTimer)
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
  clearCustomResultSound(false)
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch((error) => {
      console.warn('抽签音效上下文关闭失败', error)
    })
  }
})

const currentYear = computed(() => new Date().getFullYear())
const appVersion = __APP_VERSION__
</script>

<template>
  <div class="app-viewport">
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
        <!-- 空白状态下：居中面板（展示实时关键参数） -->
        <div v-if="pickedNames.length === 0" class="empty-placeholder-container">
          <div class="center-dashboard-card">
            <!-- 头部：待机状态 -->
            <div class="dashboard-header">
              <el-icon class="dashboard-icon"><Aim /></el-icon>
              <div class="standby-copy">
                <span class="dashboard-title">{{ nameList.length > 0 ? '名单已就绪' : '抽签待开始' }}</span>
                <span class="dashboard-subtitle">{{ nameList.length > 0 ? `${nameList.length} 人进入奖池` : '等待名单导入' }}</span>
              </div>
            </div>
            
            <div class="dashboard-divider"></div>
            
            <!-- 下部：名单、单批数、进度数据明细面板 -->
            <div class="dashboard-stats-grid">
              <div class="stat-item">
                <span class="stat-label">名单总数</span>
                <span class="stat-val highlight">{{ nameList.length }} 人</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">单批人数</span>
                <span class="stat-val highlight-blue">{{ batchSize }} 人</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已抽人数</span>
                <span class="stat-val">{{ allPickedNames.length }} 人</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">奖池剩余</span>
                <span class="stat-val highlight-green">{{ nameList.length - allPickedNames.length }} 人</span>
              </div>
              <div class="stat-item full-width">
                <span class="stat-label">当前进度</span>
                <span class="stat-val">{{ currentBatch - 1 }} / {{ totalBatches }} 轮</span>
              </div>
            </div>
          </div>
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
      </main>

      <!-- 底部控制与信息面板 (已精简收窄，高度及外边距大幅压缩，把空间彻底留给名字) -->
      <footer class="app-bottom-bar">
        <!-- 左侧：微型控制按钮组 (高度已缩减为 32px) -->
        <div class="bottom-bar-left">
          <template v-if="!isDrawing">
            <el-button 
              class="icon-pill-btn"
              @click="drawerVisible = true"
            >
              <el-icon><Setting /></el-icon>
              <span>设置</span>
            </el-button>
            
            <el-button 
              type="primary"
              class="icon-pill-btn start-btn"
              @click="startDraw"
              :disabled="nameList.length === 0 || batchSize <= 0 || currentBatch > totalBatches || nameList.length - allPickedNames.length === 0"
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
            <span class="stat-capsule">奖池剩余 <span class="stat-highlight">{{ nameList.length - allPickedNames.length }} / {{ nameList.length }}</span> 人</span>
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
      size="460px"
      class="tech-drawer"
      :destroy-on-close="false"
    >
      <div class="drawer-layout-container">
        <!-- 基础配置 (大屏显示标题输入已移除) -->
        <div class="settings-section">
          <h3 class="section-title"><el-icon><Setting /></el-icon> 抽签基本设置</h3>
          <div class="settings-form">
            <div class="form-row">
              <div class="form-item half">
                <label>单批抽取人数</label>
                <el-input-number 
                  v-model="batchSize" 
                  :min="minPickCount" 
                  :max="maxPickCount" 
                  class="w-full"
                />
              </div>
              <div class="form-item half">
                <label>总抽取轮数</label>
                <el-input-number 
                  v-model="totalBatches" 
                  :min="1" 
                  :max="100" 
                  class="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 名单录入 -->
        <div class="settings-section">
          <div class="section-header-flex">
            <h3 class="section-title"><el-icon><Aim /></el-icon> 名单管理</h3>
            <div class="header-action-group">
              <el-button type="primary" size="small" @click="triggerFileSelect" :disabled="isDrawing">
                <el-icon><Upload /></el-icon> 导入
              </el-button>
              <input
                type="file"
                ref="fileInputRef"
                @change="handleFileImport"
                accept=".txt"
                style="display: none"
              />
              <el-button type="danger" size="small" @click="clearInput" :disabled="isDrawing" plain>
                <el-icon><Delete /></el-icon> 清空
              </el-button>
            </div>
          </div>
          
          <el-input
            v-model="nameInput"
            type="textarea"
            :rows="9"
            placeholder="请输入名单，每行一个名字。或者点击导入按钮选择 .txt 文件。"
            :disabled="isDrawing"
            class="name-list-textarea"
          />
          
          <div class="stats-panel-box">
            <div class="stat-row-item">
              <span>名单总人数</span>
              <span class="stat-value-badge">{{ nameList.length }} 人</span>
            </div>
            <div class="stat-row-item">
              <span>已抽取人数</span>
              <span class="stat-value-badge text-blue">{{ allPickedNames.length }} 人</span>
            </div>
            <div class="stat-row-item">
              <span>剩余可抽取</span>
              <span class="stat-value-badge text-green">{{ nameList.length - allPickedNames.length }} 人</span>
            </div>
          </div>
        </div>

        <!-- 结束音效 -->
        <div class="settings-section">
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
                <el-icon><Upload /></el-icon> 选择 MP3
              </el-button>
              <input
                type="file"
                ref="audioFileInputRef"
                @change="handleAudioFileImport"
                accept=".mp3,audio/mpeg"
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
        </div>

        <!-- 功能按钮 -->
        <div class="settings-section">
          <h3 class="section-title"><el-icon><Refresh /></el-icon> 数据重置与导出</h3>
          <div class="action-grid-buttons">
            <el-button type="success" class="action-btn-wide" @click="exportHistory" :disabled="historyRecords.length === 0">
              <el-icon><Download /></el-icon> 导出历史记录
            </el-button>
            <el-button type="danger" class="action-btn-wide" @click="handleResetConfirm" :disabled="isDrawing" plain>
              <el-icon><Refresh /></el-icon> 重置所有抽签数据
            </el-button>
          </div>
        </div>

        <!-- 历史记录 -->
        <div class="settings-section flex-column-fill">
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
        </div>
        
        <!-- 页脚 -->
        <footer class="drawer-footer-copyright">
          <span>© {{ currentYear }} 信息科组小李 · 抽签系统 v{{ appVersion }}</span>
        </footer>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
/* 核心视口与字体设定 */
.app-viewport {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #151a23;
}

/* 浅色大屏背景：细网格负责科技感，避免影响姓名可读性。 */
.dynamic-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    linear-gradient(rgba(91, 124, 168, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91, 124, 168, 0.08) 1px, transparent 1px),
    linear-gradient(120deg, rgba(20, 118, 240, 0.08), transparent 38%),
    linear-gradient(300deg, rgba(0, 176, 148, 0.06), transparent 34%),
    #f3f7fb;
  background-size: 44px 44px, 44px 44px, 100% 100%, 100% 100%, auto;
  overflow: hidden;
  z-index: 0;
}

.dynamic-background::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 0%, rgba(38, 119, 240, 0.12) 48%, transparent 52%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), transparent 28%, rgba(255, 255, 255, 0.68));
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
  background: linear-gradient(90deg, transparent, rgba(20, 118, 240, 0.45), transparent);
}

.glow-2 {
  width: 100%;
  height: 34%;
  bottom: 0;
  right: 0;
  background: linear-gradient(180deg, transparent, rgba(229, 236, 246, 0.84));
}

.glow-3 {
  width: 34%;
  height: 100%;
  top: 0;
  right: 7%;
  background: linear-gradient(90deg, transparent, rgba(0, 176, 148, 0.08), transparent);
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
  padding: 12px 18px 10px 18px;
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

/* 汇总信息卡片置于正中间 */
.center-dashboard-card {
  background: rgba(249, 252, 255, 0.9);
  border: 1px solid rgba(112, 141, 178, 0.22);
  box-shadow: 0 24px 62px rgba(34, 63, 103, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  padding: 38px 46px;
  text-align: left;
  display: flex;
  flex-direction: column;
  width: min(620px, calc(100vw - 48px));
  box-sizing: border-box;
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

.dashboard-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
}

.dashboard-icon {
  font-size: 24px;
  color: #1476f0;
}

.standby-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dashboard-title {
  font-size: 24px;
  font-weight: 800;
  color: #151a23;
  letter-spacing: 0;
}

.dashboard-subtitle {
  font-size: 14px;
  line-height: 1.4;
  color: #667489;
  font-weight: 600;
}

.dashboard-divider {
  width: 100%;
  height: 1px;
  background: rgba(82, 112, 151, 0.14);
  margin-bottom: 22px;
}

.dashboard-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 24px;
  width: 100%;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #667489;
  border-bottom: 1px solid rgba(82, 112, 151, 0.1);
  padding-bottom: 6px;
}

.stat-item.full-width {
  grid-column: span 2;
  border-bottom: none;
  padding-bottom: 0;
}

.stat-item .stat-label {
  color: #667489;
}

.stat-item .stat-val {
  color: #151a23;
  font-weight: 700;
}

.stat-item .stat-val.highlight {
  color: #151a23;
}

.stat-item .stat-val.highlight-blue {
  color: #1476f0;
}

.stat-item .stat-val.highlight-green {
  color: #009c7f;
}

.grid-animation-wrapper {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 4px 0;
}

.interactive-grid {
  width: 100%;
  height: 100%;
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
    linear-gradient(180deg, rgba(253, 254, 255, 0.98), rgba(243, 248, 253, 0.94));
  border: 1px solid rgba(97, 128, 168, 0.2);
  box-shadow: 0 10px 28px rgba(32, 65, 105, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.94);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.24s ease, box-shadow 0.24s ease;
}

.name-card::before {
  content: '';
  position: absolute;
  inset: 7px;
  border: 1px solid rgba(20, 118, 240, 0.1);
  border-radius: 5px;
  pointer-events: none;
}

/* 滚动抽签状态 */
.name-card.is-rolling {
  transform: scale(0.985);
  background:
    linear-gradient(180deg, rgba(246, 251, 255, 0.98), rgba(236, 246, 255, 0.96));
  border-color: rgba(20, 118, 240, 0.48);
  box-shadow: 0 0 0 1px rgba(20, 118, 240, 0.12), 0 14px 32px rgba(20, 118, 240, 0.13);
}

.name-card.is-rolling .name-text {
  filter: blur(0.3px);
  opacity: 0.9;
  color: #1476f0;
}

/* 揭晓锁定状态 */
.name-card.is-revealed {
  animation: revealSpring 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 254, 0.96));
  border-color: rgba(0, 156, 127, 0.48);
  box-shadow: 0 0 0 1px rgba(0, 156, 127, 0.1), 0 14px 34px rgba(25, 63, 103, 0.11), inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.name-card.is-revealed .name-text {
  color: #111723;
  font-weight: 900;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
}

/* 顶部状态线用于提示揭晓完成，不抢人名。 */
.name-card.is-revealed::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, #1476f0, #00a889);
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
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.46) 0%, transparent 54%);
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
  background: rgba(248, 251, 255, 0.92);
  border: 1px solid rgba(97, 128, 168, 0.18);
  box-shadow: 0 10px 28px rgba(32, 65, 105, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
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

.icon-pill-btn {
  border-radius: 7px !important;
  font-weight: 600 !important;
  height: 30px !important;
  padding: 0 12px !important;
  font-size: 13px !important;
  border: 1px solid rgba(97, 128, 168, 0.18) !important;
  background: rgba(255, 255, 255, 0.86) !important;
  color: #151a23 !important;
  box-shadow: none !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.icon-pill-btn:hover {
  background: rgba(255, 255, 255, 0.98) !important;
  transform: translateY(-1px);
}

.icon-pill-btn.start-btn {
  background: linear-gradient(180deg, #2184ff, #1167de) !important;
  color: white !important;
  border: none !important;
  box-shadow: 0 6px 16px rgba(20, 118, 240, 0.18) !important;
}

.icon-pill-btn.start-btn:hover {
  box-shadow: 0 8px 20px rgba(20, 118, 240, 0.24) !important;
}

.icon-pill-btn.stop-btn {
  background: linear-gradient(180deg, #ff4d43, #d62d23) !important;
  color: white !important;
  border: none !important;
  box-shadow: 0 3px 8px rgba(255, 59, 48, 0.15) !important;
  animation: pulseGlowBtn 1.5s infinite;
}

@keyframes pulseGlowBtn {
  0% { transform: scale(1); box-shadow: 0 3px 8px rgba(255, 59, 48, 0.15); }
  50% { transform: scale(1.02); box-shadow: 0 5px 12px rgba(255, 59, 48, 0.25); }
  100% { transform: scale(1); box-shadow: 0 3px 8px rgba(255, 59, 48, 0.15); }
}

.icon-pill-btn.danger {
  color: #d62d23 !important;
}

.icon-pill-btn.danger:hover {
  background: rgba(255, 59, 48, 0.05) !important;
  border-color: rgba(255, 59, 48, 0.15) !important;
}

.icon-pill-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  background: rgba(0, 0, 0, 0.04) !important;
  color: rgba(0, 0, 0, 0.25) !important;
  border: 1px solid rgba(0, 0, 0, 0.03) !important;
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
  color: #667489;
}

.stat-capsule {
  color: #667489;
}

.stat-highlight {
  color: #253040;
  font-weight: 800;
}

.stat-divider {
  color: rgba(0, 0, 0, 0.1);
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
  color: rgba(37, 48, 64, 0.42);
  letter-spacing: 0;
  white-space: nowrap;
}

/* 右侧高级设置面板抽屉 */
:deep(.tech-drawer) {
  background-color: #fbfbfd !important;
  backdrop-filter: blur(20px);
}

:deep(.el-drawer__header) {
  margin-bottom: 16px;
  padding: 24px 24px 0 24px;
}

:deep(.el-drawer__title) {
  font-size: 20px;
  font-weight: 700;
  color: #1d1d1f;
}

:deep(.el-drawer__body) {
  padding: 0 24px 24px 24px;
}

.drawer-layout-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-section.flex-column-fill {
  flex: 1;
  min-height: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #86868b;
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
  color: #1d1d1f;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-item.half {
  flex: 1;
}

.name-list-textarea :deep(.el-textarea__inner) {
  border-radius: 12px;
  font-family: monospace;
  font-size: 13px;
  border-color: rgba(0, 0, 0, 0.08);
  background: #ffffff;
  padding: 12px;
  transition: all 0.3s;
}

.name-list-textarea :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  border-color: #007aff;
}

/* 抽屉内统计卡片 */
.stats-panel-box {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.03);
  border-radius: 14px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-row-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: #515154;
}

.stats-panel-box .stat-row-item:last-child {
  border-top: 1px solid rgba(0, 0, 0, 0.03);
  padding-top: 10px;
}

.stat-value-badge {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #1d1d1f;
  font-weight: 700;
}

.stat-value-badge.text-blue {
  color: #007aff;
  background: rgba(0, 122, 255, 0.05);
  border-color: rgba(0, 122, 255, 0.1);
}

.stat-value-badge.text-green {
  color: #34c759;
  background: rgba(52, 199, 89, 0.05);
  border-color: rgba(52, 199, 89, 0.1);
}

/* 结束音效设置 */
.sound-panel-box {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.03);
  border-radius: 14px;
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
  color: #515154;
  flex-shrink: 0;
}

.sound-name {
  min-width: 0;
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}

.sound-name.is-custom {
  color: #007aff;
  background: rgba(0, 122, 255, 0.05);
  border-color: rgba(0, 122, 255, 0.1);
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
  border: 1px solid rgba(0, 0, 0, 0.05);
  background: #ffffff;
  border-radius: 14px;
  overflow-y: auto;
  padding: 14px;
}

.empty-history-placeholder {
  text-align: center;
  color: #86868b;
  font-size: 13px;
  padding: 40px 0;
}

.history-list-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-record-card {
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
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
  background: #1d1d1f;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 6px;
}

.record-count-badge {
  font-size: 11px;
  color: #86868b;
  font-weight: 600;
}

.history-record-card-names {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.history-name-tag {
  background: #f5f5f7;
  border: 1px solid rgba(0, 0, 0, 0.03);
  color: #515154;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.drawer-footer-copyright {
  text-align: center;
  font-size: 11px;
  color: #86868b;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 16px;
}

/* 针对 Element Plus 组件的部分覆盖适配 */
.w-full {
  width: 100%;
}
</style>
