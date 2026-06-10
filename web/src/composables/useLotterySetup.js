import { nextTick, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { QUICK_SETUP_DELAY_MS } from '../constants/lottery'
import { isTextNameFile, readTextFile } from '../utils/fileImport'
import { resetQuickSetupValues, syncLocalizedNumberControls, validateQuickSetup } from '../utils/lotterySetupHelpers'
import { createPrizeItem, getValidPrizeItems } from '../utils/prizePlan'

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
    quickSetupDrawSize: state.quickSetupDrawSize,
    quickSetupDrawTimes: state.quickSetupDrawTimes,
    quickSetupPrizeName: state.quickSetupPrizeName,
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
  quickSetupDrawSize: ref(1),
  quickSetupDrawTimes: ref(1),
  quickSetupPrizeName: ref('一等奖'),
  quickSetupTimer: null,
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
    nameList: context.nameList,
    prizeItems: context.prizeItems,
    quickSetupDrawSize: context.state.quickSetupDrawSize,
    quickSetupDrawTimes: context.state.quickSetupDrawTimes,
    quickSetupPrizeName: context.state.quickSetupPrizeName
  })
  context.state.quickSetupVisible.value = true
  syncLocalizedAriaLabels()
}

const scheduleQuickSetupDialog = (context) => {
  const { isThreeStage, state } = context
  if (!state.pendingQuickSetupAfterImport.value) return
  state.pendingQuickSetupAfterImport.value = false
  if (!isThreeStage.value || getValidPrizeItems(context.prizeItems.value).length > 0) return

  if (state.quickSetupTimer) window.clearTimeout(state.quickSetupTimer)
  state.quickSetupTimer = window.setTimeout(() => {
    context.openQuickSetupDialog()
    state.quickSetupTimer = null
  }, QUICK_SETUP_DELAY_MS)
}

const confirmSetupDialog = (context) => {
  const setup = validateQuickSetup({
    quickSetupDrawSize: context.state.quickSetupDrawSize,
    quickSetupDrawTimes: context.state.quickSetupDrawTimes,
    quickSetupPrizeName: context.state.quickSetupPrizeName,
    remainingCount: context.remainingCount
  })
  if (!setup) return

  context.prizeItems.value = [
    createPrizeItem({
      name: setup.prizeName,
      drawSize: setup.nextDrawSize,
      drawTimes: setup.nextDrawTimes
    })
  ]
  context.state.quickSetupVisible.value = false
  ElMessage.success('奖项设置已就绪')
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
