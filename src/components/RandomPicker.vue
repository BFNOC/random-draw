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
// 文件输入引用
const fileInputRef = ref(null)
// 历史记录
const historyRecords = ref([])
// 最终录入的幸运儿名单
const finalPickedNames = ref([])

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
  } else if (count <= 9) {
    cols = 3; rows = 3;
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
    gap: count <= 12 ? '24px' : count <= 30 ? '16px' : '10px',
    width: '100%',
    height: '100%',
  }
})

// 根据卡片总数计算基础字体大小与边距 (针对户外大屏特意做特大字体适配)
const nameCardStyle = computed(() => {
  const count = pickedNames.value.length
  let fontSize = '2rem'
  let padding = '1rem'
  
  if (count === 1) {
    fontSize = '14vw'
    padding = '2rem'
  } else if (count === 2) {
    fontSize = '9.5vw'
    padding = '1.8rem'
  } else if (count <= 4) {
    fontSize = '7.5vw'
    padding = '1.5rem'
  } else if (count <= 9) {
    fontSize = '5.8vw'
    padding = '1.2rem'
  } else if (count <= 16) {
    fontSize = '4.3vw'
    padding = '1rem'
  } else if (count <= 25) {
    fontSize = '3.3vw'
    padding = '0.8rem'
  } else if (count <= 36) {
    fontSize = '2.7vw'
    padding = '0.6rem'
  } else if (count <= 49) {
    fontSize = '2.3vw'
    padding = '0.5rem'
  } else {
    // 50人及以上
    fontSize = '1.95vw'
    padding = '0.4rem'
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
    styles.fontSize = `calc(${styles.fontSize} * 0.72)`
    styles.letterSpacing = '-0.03em'
  } else if (length === 3) {
    styles.letterSpacing = '0.08em'
  } else if (length === 2) {
    styles.letterSpacing = '0.4em'
    styles.textIndent = '0.4em' // 居中修正
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
})

const currentYear = computed(() => new Date().getFullYear())
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
          <span class="bottom-copyright">© {{ currentYear }} 信息科组小李 · 抽签系统</span>
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
          <span>© {{ currentYear }} 信息科组小李 · 抽签系统</span>
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
  color: #1d1d1f;
}

/* 动态科技背景 - 浅色 Apple 风格 */
.dynamic-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #f5f5f7;
  overflow: hidden;
  z-index: 0;
}

.ambient-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(140px);
  opacity: 0.45;
  mix-blend-mode: multiply;
  pointer-events: none;
  animation: floatAmbient 20s infinite alternate ease-in-out;
}

.glow-1 {
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, rgba(0, 122, 255, 0.18) 0%, transparent 70%);
  top: -15%;
  left: -10%;
}

.glow-2 {
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(175, 82, 222, 0.14) 0%, transparent 70%);
  bottom: -20%;
  right: -10%;
  animation-delay: -5s;
}

.glow-3 {
  width: 45vw;
  height: 45vw;
  background: radial-gradient(circle, rgba(52, 199, 89, 0.08) 0%, transparent 70%);
  top: 30%;
  left: 40%;
  animation-delay: -10s;
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
  padding: 16px 24px 12px 24px; /* 上下内边距收窄 */
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
  backdrop-filter: blur(30px);
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border-radius: 32px;
  padding: 44px 52px;
  text-align: left;
  display: flex;
  flex-direction: column;
  width: 580px;
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
  color: #007aff;
}

.standby-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dashboard-title {
  font-size: 24px;
  font-weight: 800;
  color: #1d1d1f;
  letter-spacing: -0.01em;
}

.dashboard-subtitle {
  font-size: 14px;
  line-height: 1.4;
  color: #86868b;
  font-weight: 600;
}

.dashboard-divider {
  width: 100%;
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
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
  color: #86868b;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.04);
  padding-bottom: 6px;
}

.stat-item.full-width {
  grid-column: span 2;
  border-bottom: none;
  padding-bottom: 0;
}

.stat-item .stat-label {
  color: #86868b;
}

.stat-item .stat-val {
  color: #1d1d1f;
  font-weight: 700;
}

.stat-item .stat-val.highlight {
  color: #1d1d1f;
}

.stat-item .stat-val.highlight-blue {
  color: #007aff;
}

.stat-item .stat-val.highlight-green {
  color: #34c759;
}

.grid-animation-wrapper {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
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
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 滚动抽签状态 */
.name-card.is-rolling {
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(0, 122, 255, 0.35);
  box-shadow: 0 0 24px rgba(0, 122, 255, 0.14);
}

.name-card.is-rolling .name-text {
  filter: blur(0.6px);
  opacity: 0.85;
  color: #007aff; /* 滚动时名字呈现亮眼的苹果科技蓝 */
}

/* 揭晓锁定状态 */
.name-card.is-revealed {
  animation: revealSpring 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.25) forwards;
  background: linear-gradient(135deg, #ffffff 0%, #fbfbfd 100%);
  border-color: rgba(212, 175, 55, 0.35); /* 精致的淡金色边框，富有高级感 */
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.name-card.is-revealed .name-text {
  color: #1d1d1f;
  font-weight: 900; /* 特粗设计，大屏视觉可读性最强 */
  text-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

/* 顶部科技感双色微渐变饰条 */
.name-card.is-revealed::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 5px;
  background: linear-gradient(90deg, #007aff, #8962e7);
  opacity: 0.95;
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
  transition: all 0.3s ease;
  white-space: nowrap;
  line-height: 1.1;
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, transparent 60%);
  z-index: 1;
}

/* 一体化底部控制信息栏 (高度和外边距已大幅缩减，专注于操作台的辅助定位) */
.app-bottom-bar {
  height: 48px; /* 从 64px 缩减到 48px */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  backdrop-filter: blur(25px);
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-top: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  z-index: 10;
  box-sizing: border-box;
  margin-top: 8px; /* 从 16px 缩减到 8px，完全释放名字空间 */
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
  border-radius: 9999px !important;
  font-weight: 600 !important;
  height: 32px !important; /* 从 40px 缩减到 32px */
  padding: 0 14px !important;
  font-size: 13px !important;
  border: 1px solid rgba(0, 0, 0, 0.05) !important;
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(20px) !important;
  color: #1d1d1f !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02) !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.icon-pill-btn:hover {
  background: rgba(255, 255, 255, 0.95) !important;
  transform: translateY(-1px);
}

.icon-pill-btn.start-btn {
  background: linear-gradient(185deg, #007aff, #005ecb) !important;
  color: white !important;
  border: none !important;
  box-shadow: 0 3px 8px rgba(0, 122, 255, 0.15) !important;
}

.icon-pill-btn.start-btn:hover {
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25) !important;
}

.icon-pill-btn.stop-btn {
  background: linear-gradient(185deg, #ff3b30, #d01d12) !important;
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
  color: #ff3b30 !important;
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
  font-size: 13px; /* 字号缩小到 13px，非常低调 */
  font-weight: 700;
  color: #86868b;
}

.stat-capsule {
  color: #86868b;
}

.stat-highlight {
  color: #515154; /* 调低亮度，防喧宾夺主 */
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
  font-size: 12px; /* 版权标志缩至 12px，极简设计 */
  font-weight: 600;
  color: rgba(0, 0, 0, 0.3);
  letter-spacing: 0.01em;
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
