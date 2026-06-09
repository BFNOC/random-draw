import { nextTick, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { QUICK_SETUP_DELAY_MS } from '../constants/lottery'
import { isTextNameFile, readTextFile } from '../utils/fileImport'
import { resetQuickSetupValues, syncLocalizedNumberControls, validateQuickSetup } from '../utils/lotterySetupHelpers'

export const useLotterySetup = ({
  adjustPickCount,
  batchSize,
  isThreeStage,
  nameInput,
  nameList,
  remainingCount,
  totalBatches
}) => {
  const state = createSetupState()
  const context = { adjustPickCount, batchSize, isThreeStage, nameInput, nameList, remainingCount, state, totalBatches }

  const syncLocalizedAriaLabels = () => syncLocalizedNumberControls(nextTick)
  const openDrawer = tab => openSetupDrawer(state, syncLocalizedAriaLabels, tab)
  const triggerFileSelect = mode => triggerSetupFileSelect(state, mode)
  const confirmQuickSetup = () => confirmSetupDialog(context)
  const handleFileImport = event => importNameFile(context, event)

  context.openQuickSetupDialog = () => openQuickSetupDialog(context, syncLocalizedAriaLabels)

  onUnmounted(() => {
    if (state.quickSetupTimer) window.clearTimeout(state.quickSetupTimer)
  })

  return {
    activeSettingsTab: state.activeSettingsTab,
    drawerVisible: state.drawerVisible,
    fileInputRef: state.fileInputRef,
    quickSetupBatchSize: state.quickSetupBatchSize,
    quickSetupTotalBatches: state.quickSetupTotalBatches,
    quickSetupVisible: state.quickSetupVisible,
    confirmQuickSetup,
    handleFileImport,
    openDrawer,
    syncLocalizedAriaLabels,
    triggerFileSelect
  }
}

const createSetupState = () => ({
  activeSettingsTab: ref('prepare'),
  drawerVisible: ref(false),
  fileInputRef: ref(null),
  pendingQuickSetupAfterImport: ref(false),
  quickSetupBatchSize: ref(50),
  quickSetupTimer: null,
  quickSetupTotalBatches: ref(4),
  quickSetupVisible: ref(false)
})

const openSetupDrawer = async (state, syncLocalizedAriaLabels, tab = 'prepare') => {
  state.activeSettingsTab.value = tab
  state.drawerVisible.value = true
  await syncLocalizedAriaLabels()
}

const triggerSetupFileSelect = (state, mode = 'drawer') => {
  state.pendingQuickSetupAfterImport.value = mode === 'three'
  state.fileInputRef.value?.click()
}

const openQuickSetupDialog = (context, syncLocalizedAriaLabels) => {
  resetQuickSetupValues({
    batchSize: context.batchSize,
    nameList: context.nameList,
    quickSetupBatchSize: context.state.quickSetupBatchSize,
    quickSetupTotalBatches: context.state.quickSetupTotalBatches,
    totalBatches: context.totalBatches
  })
  context.state.quickSetupVisible.value = true
  syncLocalizedAriaLabels()
}

const scheduleQuickSetupDialog = (context) => {
  const { isThreeStage, state } = context
  if (!state.pendingQuickSetupAfterImport.value || !isThreeStage.value) return

  state.pendingQuickSetupAfterImport.value = false
  if (state.quickSetupTimer) window.clearTimeout(state.quickSetupTimer)
  state.quickSetupTimer = window.setTimeout(() => {
    context.openQuickSetupDialog()
    state.quickSetupTimer = null
  }, QUICK_SETUP_DELAY_MS)
}

const confirmSetupDialog = (context) => {
  const setup = validateQuickSetup({
    quickSetupBatchSize: context.state.quickSetupBatchSize,
    quickSetupTotalBatches: context.state.quickSetupTotalBatches,
    remainingCount: context.remainingCount
  })
  if (!setup) return

  context.batchSize.value = setup.nextBatchSize
  context.totalBatches.value = setup.nextTotalBatches
  context.state.quickSetupVisible.value = false
  ElMessage.success('抽奖设置已就绪')
}

const importNameFile = async (context, event) => {
  const file = event.target.files[0]
  if (!file) return

  if (!isTextNameFile(file)) {
    ElMessage.error('请选择文本文件 (.txt)')
    event.target.value = ''
    return
  }

  try {
    context.nameInput.value = await readTextFile(file)
    context.adjustPickCount()
    ElMessage.success(`成功导入名单，共 ${context.nameList.value.length} 人`)
    scheduleQuickSetupDialog(context)
  } catch (error) {
    ElMessage.error('读取文件失败')
  } finally {
    event.target.value = ''
  }
}
