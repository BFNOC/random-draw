import { computed, nextTick, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { QUICK_SETUP_DELAY_MS } from '../constants/lottery'
import { isTextNameFile, readTextFile } from '../utils/fileImport'
import {
  getPrizeItemsCapacityWarning,
  resetQuickSetupPrizeItems,
  syncLocalizedNumberControls,
  validateQuickSetupPrizeItems
} from '../utils/lotterySetupHelpers'
import { createDefaultPrizeItems, getValidPrizeItems } from '../utils/prizePlan'
import {
  clearStoredQuickSetupPrizeItems,
  getStoredQuickSetupPrizeItems,
  saveQuickSetupPrizeItems
} from '../utils/quickSetupStorage'

export const useLotterySetup = ({
  isThreeStage,
  nameInput,
  nameList,
  prizeItems,
  remainingCount
}) => {
  const state = createSetupState()
  const context = { isThreeStage, nameInput, nameList, prizeItems, remainingCount, state }

  const syncLocalizedAriaLabels = () => syncLocalizedNumberControls(nextTick)
  const openDrawer = tab => openSetupDrawer(state, syncLocalizedAriaLabels, tab)
  const triggerFileSelect = mode => triggerSetupFileSelect(state, mode)
  const applyStoredQuickSetup = () => applyStoredQuickSetupSettings(context)
  const clearStoredQuickSetup = () => clearQuickSetupStorage(state)
  const confirmQuickSetup = () => confirmSetupDialog(context)
  const handleFileImport = event => importNameFile(context, event)
  const storedQuickSetupWarning = computed(() => getPrizeItemsCapacityWarning(state.storedQuickSetupPrizeItems.value, remainingCount.value))

  context.openQuickSetupDialog = () => openQuickSetupDialog(context, syncLocalizedAriaLabels)

  onUnmounted(() => {
    if (state.quickSetupTimer) window.clearTimeout(state.quickSetupTimer)
  })

  return {
    activeSettingsTab: state.activeSettingsTab,
    drawerVisible: state.drawerVisible,
    fileInputRef: state.fileInputRef,
    hasStoredQuickSetup: state.hasStoredQuickSetup,
    quickSetupPrizeItems: state.quickSetupPrizeItems,
    quickSetupVisible: state.quickSetupVisible,
    storedQuickSetupPrizeItems: state.storedQuickSetupPrizeItems,
    storedQuickSetupWarning,
    applyStoredQuickSetup,
    clearStoredQuickSetup,
    confirmQuickSetup,
    handleFileImport,
    openDrawer,
    syncLocalizedAriaLabels,
    triggerFileSelect
  }
}

const createSetupState = () => {
  const storedItems = getStoredQuickSetupPrizeItems()

  return {
    activeSettingsTab: ref('prepare'),
    drawerVisible: ref(false),
    fileInputRef: ref(null),
    hasStoredQuickSetup: ref(storedItems.length > 0),
    pendingQuickSetupAfterImport: ref(false),
    quickSetupPrizeItems: ref(createDefaultPrizeItems()),
    quickSetupTimer: null,
    quickSetupVisible: ref(false),
    storedQuickSetupPrizeItems: ref(storedItems)
  }
}

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
  refreshStoredQuickSetupState(context.state)
  resetQuickSetupPrizeItems({
    prizeItems: context.prizeItems,
    quickSetupPrizeItems: context.state.quickSetupPrizeItems
  })
  context.state.quickSetupVisible.value = true
  syncLocalizedAriaLabels()
}

const scheduleQuickSetupDialog = (context) => {
  const { isThreeStage, state } = context
  if (!state.pendingQuickSetupAfterImport.value) return
  state.pendingQuickSetupAfterImport.value = false
  if (!isThreeStage.value || getValidPrizeItems(context.prizeItems.value).length > 0) return

  const storedItems = refreshStoredQuickSetupState(state)
  if (storedItems.length > 0) {
    return showStoredQuickSetupAfterImport(context, storedItems)
  }

  if (state.quickSetupTimer) window.clearTimeout(state.quickSetupTimer)
  state.quickSetupTimer = window.setTimeout(() => {
    context.openQuickSetupDialog()
    state.quickSetupTimer = null
  }, QUICK_SETUP_DELAY_MS)
}

const showStoredQuickSetupAfterImport = (context, storedItems) => {
  context.state.quickSetupPrizeItems.value = storedItems
  ElMessage.info('已找到上次保存的抽奖设置，可在弹窗中选择使用或调整')
  if (context.state.quickSetupTimer) window.clearTimeout(context.state.quickSetupTimer)
  context.state.quickSetupTimer = window.setTimeout(() => {
    context.state.quickSetupVisible.value = true
    context.state.quickSetupTimer = null
  }, QUICK_SETUP_DELAY_MS)
}

const applyStoredQuickSetupSettings = (context) => {
  const storedItems = refreshStoredQuickSetupState(context.state)
  if (storedItems.length === 0) {
    ElMessage.warning('暂无保存的抽奖设置')
    return
  }

  const capacityWarning = getPrizeItemsCapacityWarning(storedItems, context.remainingCount.value)
  if (capacityWarning) {
    ElMessage.warning(capacityWarning)
    return
  }

  context.prizeItems.value = storedItems
  context.state.quickSetupPrizeItems.value = storedItems
  context.state.quickSetupVisible.value = false
  ElMessage.success('已使用上次保存的抽奖设置')
}

const confirmSetupDialog = (context) => {
  const nextPrizeItems = validateQuickSetupPrizeItems({
    quickSetupPrizeItems: context.state.quickSetupPrizeItems,
    remainingCount: context.remainingCount
  })
  if (!nextPrizeItems) return

  context.prizeItems.value = nextPrizeItems
  context.state.hasStoredQuickSetup.value = saveQuickSetupPrizeItems(nextPrizeItems)
  context.state.storedQuickSetupPrizeItems.value = context.state.hasStoredQuickSetup.value ? getStoredQuickSetupPrizeItems() : []
  context.state.quickSetupVisible.value = false
  ElMessage.success(context.state.hasStoredQuickSetup.value ? '奖项设置已就绪，已保存到本机' : '奖项设置已就绪，本机保存失败')
}

const clearQuickSetupStorage = (state) => {
  if (!clearStoredQuickSetupPrizeItems()) {
    ElMessage.warning('清除本机抽奖设置失败')
    return
  }

  state.hasStoredQuickSetup.value = false
  state.storedQuickSetupPrizeItems.value = []
  ElMessage.success('已清除本机保存的抽奖设置')
}

const refreshStoredQuickSetupState = (state) => {
  const storedItems = getStoredQuickSetupPrizeItems()
  state.storedQuickSetupPrizeItems.value = storedItems
  state.hasStoredQuickSetup.value = storedItems.length > 0
  return storedItems
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
    ElMessage.success(`成功导入名单，共 ${context.nameList.value.length} 人`)
    scheduleQuickSetupDialog(context)
  } catch (error) {
    ElMessage.error('读取文件失败')
  } finally {
    event.target.value = ''
  }
}
