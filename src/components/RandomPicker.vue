<script setup>
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
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

// 每批次抽取的人数
const batchSize = ref(12)
// 最大抽取人数
const maxPickCount = computed(() => Math.max(1, nameList.value.length))
// 有效的最小抽取人数
const minPickCount = computed(() => nameList.value.length > 0 ? 1 : 1)
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
// 抽取动画的计时器
let drawingTimer = null
// 文件输入引用
const fileInputRef = ref(null)
// 历史记录
const historyRecords = ref([])

// 监听名单变化，调整抽取人数
const adjustPickCount = () => {
  if (nameList.value.length > 0 && batchSize.value > nameList.value.length) {
    batchSize.value = nameList.value.length
  }
}

// 触发文件选择
const triggerFileSelect = () => {
  fileInputRef.value.click()
}

// 处理文件导入
const handleFileImport = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 检查文件类型，只接受文本文件
  if (!file.type.match('text.*') && !file.name.endsWith('.txt')) {
    ElMessage.error('请选择文本文件')
    event.target.value = '' // 清空文件输入
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      nameInput.value = content
      adjustPickCount()
      ElMessage.success(`成功导入名单，共 ${nameList.value.length} 人`)
    } catch (error) {
      ElMessage.error('导入失败，请检查文件格式')
    }
    event.target.value = '' // 清空文件输入，允许再次选择同一文件
  }
  
  reader.onerror = () => {
    ElMessage.error('读取文件失败')
    event.target.value = '' // 清空文件输入
  }
  
  reader.readAsText(file)
}

// 开始抽签
const startDraw = () => {
  if (nameList.value.length === 0) {
    ElMessage.warning('请先输入名单')
    return
  }
  
  // 检查剩余可抽取人数
  const remainingNames = nameList.value.filter(name => !allPickedNames.value.includes(name))
  if (remainingNames.length === 0) {
    ElMessage.warning('所有人都已被抽取，请清空结果后重试')
    return
  }
  
  if (batchSize.value <= 0) {
    ElMessage.warning('抽取人数必须大于0')
    return
  }
  
  if (batchSize.value > remainingNames.length) {
    ElMessage.warning(`剩余可抽取人数为${remainingNames.length}人，请减少单批次抽取人数`)
    return
  }
  
  isDrawing.value = true
  const interval = 50 // 每50毫秒更新一次
  
  // 清除之前的计时器
  if (drawingTimer) {
    clearInterval(drawingTimer)
  }
  
  // 动画效果：快速切换显示的名字，直到用户手动停止
  drawingTimer = setInterval(() => {
    // 随机抽取临时展示用的名字（从未抽取过的名字中选择）
    const tempNames = []
    const tempCount = Math.min(batchSize.value, remainingNames.length)
    
    for (let i = 0; i < tempCount; i++) {
      const randomIndex = Math.floor(Math.random() * remainingNames.length)
      tempNames.push(remainingNames[randomIndex])
    }
    
    pickedNames.value = tempNames
  }, interval)
}

// 停止抽取
const stopDraw = () => {
  if (!isDrawing.value) return
  
  // 清除计时器
  if (drawingTimer) {
    clearInterval(drawingTimer)
  }
  
  // 确定最终结果（不重复）
  const remainingNames = nameList.value.filter(name => !allPickedNames.value.includes(name))
  const namesCopy = [...remainingNames]
  
  // 洗牌算法
  for (let i = namesCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [namesCopy[i], namesCopy[j]] = [namesCopy[j], namesCopy[i]]
  }
  
  // 取前N个
  const finalNames = namesCopy.slice(0, Math.min(batchSize.value, namesCopy.length))
  pickedNames.value = finalNames
  
  // 添加到已抽取名单中
  allPickedNames.value = [...allPickedNames.value, ...finalNames]
  
  // 记录当次历史
  historyRecords.value.unshift({
    batch: currentBatch.value,
    names: finalNames,
  })

  // 更新批次
  currentBatch.value += 1
  
  isDrawing.value = false
  ElMessage.success(`第 ${currentBatch.value - 1} 批次抽取完成，已抽取 ${finalNames.length} 人`)

  // 触发烟花效果
  triggerConfetti()
}

// 触发烟花效果
const triggerConfetti = () => {
  const count = 200
  const defaults = {
    origin: { y: 0.7 }
  }

  const fire = (particleRatio, opts) => {
  confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
    })
    }

    fire(0.25, {
    spread: 26,
    startVelocity: 55,
    })
    fire(0.2, {
    spread: 60,
    })
    fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
    })
    fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
    })
    fire(0.1, {
    spread: 120,
    startVelocity: 45,
    })
}

// 清空结果
const clearResult = () => {
  pickedNames.value = []
  allPickedNames.value = []
  currentBatch.value = 1
  historyRecords.value = []
}

// 清空输入
const clearInput = () => {
  nameInput.value = ''
  pickedNames.value = []
  allPickedNames.value = []
  currentBatch.value = 1
  historyRecords.value = []
}

const exportHistory = () => {
  if (historyRecords.value.length === 0) {
    ElMessage.warning('没有可导出的历史记录')
    return
  }
  
  // 历史记录是 unshift 进去的，所以是倒序的。导出时反转为正序。
  const orderedHistory = [...historyRecords.value].reverse()
  
  const content = orderedHistory.map(record => {
    const header = `第${record.batch}批/共${totalBatches.value}批：`
    const names = record.names.join('\n')
    return `${header}\n${names}`
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
</script>

<template>
  <div class="random-picker-container">
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 左上：输入名单区域 -->
      <div class="input-panel">
        <el-card class="input-card">
          <template #header>
            <div class="card-header">
              <span>输入名单（每行一个名字）</span>
              <div class="header-buttons">
                <el-button type="primary" @click="triggerFileSelect" :disabled="isDrawing">
                  <el-icon><Upload /></el-icon>导入名单
                </el-button>
                <input
                  type="file"
                  ref="fileInputRef"
                  @change="handleFileImport"
                  accept=".txt"
                  style="display: none"
                />
                <el-button type="danger" @click="clearInput" :disabled="isDrawing">清空</el-button>
              </div>
            </div>
          </template>
          <el-input
            v-model="nameInput"
            type="textarea"
            :rows="8"
            placeholder="请输入名单，每行一个名字，或者点击上方的导入按钮选择文本文件"
            :disabled="isDrawing"
            @input="adjustPickCount"
          />
          <div class="name-count">
            已输入: <span class="highlight">{{ nameList.length }}</span> 人
            <span v-if="allPickedNames.length > 0" class="picked-info">
              已抽取: <span class="highlight">{{ allPickedNames.length }}</span> 人
              (剩余: <span class="highlight">{{ nameList.length - allPickedNames.length }}</span> 人)
            </span>
          </div>
        </el-card>
      </div>
      
      <!-- 右上：抽取结果区域 -->
      <div class="result-panel">
        <el-card class="result-card">
          <template #header>
            <div class="card-header">
              <span v-if="currentBatch > 1">第 {{ currentBatch - 1 }} 批次抽取结果 ({{ pickedNames.length }} 人)</span>
              <span v-else>抽取结果 ({{ pickedNames.length }} 人)</span>
            </div>
          </template>
          <div class="result-content">
            <div v-if="pickedNames.length === 0" class="empty-result">
              <el-empty description="等待抽取结果" />
            </div>
            <div v-else class="result-list">
              <div v-for="(name, index) in pickedNames" :key="index" class="result-item">
                <div class="name-card">{{ name }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </div>
      
      <!-- 左下：抽取控制区域 -->
      <div class="control-panel">
        <el-card>
          <div class="draw-controls">
            <div class="control-row">
              <div class="control-group">
                <span class="label">每批次人数:</span>
                <el-input-number
                  v-model="batchSize"
                  :min="minPickCount"
                  :max="maxPickCount"
                  :disabled="isDrawing || nameList.length === 0"
                />
              </div>
              
              <div class="control-group">
                <span class="label">总批次数:</span>
                <el-input-number
                  v-model="totalBatches"
                  :min="1"
                  :max="10"
                  :disabled="isDrawing"
                />
              </div>
              
              <div class="control-group">
                <span class="label">当前批次:</span>
                <span class="batch-info">{{ currentBatch - 1 }}/{{ totalBatches }}</span>
              </div>
            </div>
            
            <div class="button-group">
              <el-button
                type="primary"
                size="large"
                @click="startDraw"
                :disabled="isDrawing || nameList.length === 0 || currentBatch > totalBatches || nameList.length - allPickedNames.length === 0"
              >
                开始抽取
              </el-button>
              
              <el-button
                type="warning"
                size="large"
                @click="stopDraw"
                :disabled="!isDrawing"
              >
                停止抽取
              </el-button>
              
              <el-button 
                size="large"
                @click="clearResult" 
                :disabled="isDrawing || (pickedNames.length === 0 && allPickedNames.length === 0)"
              >
                清空结果
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>
    
    <!-- 底部：历史抽取记录区域 -->
    <div class="history-panel">
      <el-card class="history-card">
        <template #header>
          <div class="card-header">
            <span>历史抽取记录</span>
            <el-button
              type="success"
              size="large"
              @click="exportHistory"
              :disabled="historyRecords.length === 0"
            >
              一键导出所有记录
            </el-button>
          </div>
        </template>
        <div class="history-content">
          <div v-if="historyRecords.length === 0" class="empty-history">
            暂无历史抽取记录
          </div>
          <div v-else class="history-list">
            <div v-for="record in historyRecords" :key="record.batch" class="history-batch">
              <div class="history-batch-header">第 {{ record.batch }} 批:</div>
              <div class="history-batch-names">
                <el-tag
                  v-for="(name, index) in record.names"
                  :key="index"
                  size="small"
                  class="history-item"
                >
                  {{ name }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.random-picker-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  display: grid;
  grid-template-columns: 0.6fr 1.4fr;
  grid-template-rows: 1fr auto;
  gap: 10px;
  padding: 10px;
  height: 0; /* 重要：让flex子元素可以缩小 */
  min-height: 0; /* 重要：允许网格收缩 */
  grid-template-areas: 
    "input result"
    "control result";
}

.input-panel {
  grid-area: input;
  min-height: 0;
}

.result-panel {
  grid-area: result;
  min-height: 0;
}

.control-panel {
  grid-area: control;
  min-height: 0;
}

.input-card {
  height: 100%;
}

.result-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.result-content {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.history-panel {
  flex: 0 0 200px; /* 固定高度 */
  padding: 0 10px 10px 10px;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许在flex布局中收缩 */
}

.history-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.history-content {
  overflow-y: auto;
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-buttons {
  display: flex;
  gap: 10px;
}

.name-count {
  margin-top: 10px;
  text-align: right;
  color: #606266;
}

.picked-info {
  margin-left: 15px;
}

.highlight {
  color: #409EFF;
  font-weight: bold;
  font-size: 1.1em;
}

.draw-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 10px 0;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  width: 100%;
  gap: 10px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
  width: 100%;
}

.label {
  font-size: 16px;
  min-width: 90px;
  text-align: right;
}

.batch-info {
  font-size: 18px;
  font-weight: bold;
  color: #409EFF;
}

.empty-result {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  padding: 15px;
}

.result-item {
  display: flex;
  justify-content: center;
}

.name-card {
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
  color: #409EFF;
  border-radius: 5px;
  padding: 15px 10px;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
}

.name-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.history-batch {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-batch-header {
  font-weight: bold;
  color: #303133;
}

.history-batch-names {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.history-item {
  margin: 2px;
}

.empty-history {
  width: 100%;
  text-align: center;
  color: #909399;
  padding: 40px 0;
  font-size: 14px;
}

:deep(.el-card__body) {
  height: calc(100% - 100px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.el-card__body) .el-textarea {
  flex: 1; /* 让文本域占据所有可用空间 */
  min-height: 0; /* 允许文本域收缩 */
}

:deep(.el-textarea__inner) {
  height: 100% !important;
}

@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas: 
      "input"
      "control"
      "result";
  }
  
  .result-list {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
  
  .name-card {
    padding: 10px 5px;
    font-size: 16px;
  }
}
</style> 