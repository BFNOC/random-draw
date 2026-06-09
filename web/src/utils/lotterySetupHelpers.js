import { ElMessage } from 'element-plus'

export const syncLocalizedNumberControls = async (nextTick) => {
  await nextTick()
  setAriaLabel('.tech-drawer .el-input-number__decrease', '减少数字')
  setAriaLabel('.tech-drawer .el-input-number__increase', '增加数字')
}

export const resetQuickSetupValues = ({ batchSize, nameList, quickSetupBatchSize, quickSetupTotalBatches, totalBatches }) => {
  quickSetupBatchSize.value = batchSize.value > 0
    ? batchSize.value
    : Math.min(50, Math.max(1, nameList.value.length))
  quickSetupTotalBatches.value = totalBatches.value > 0 ? totalBatches.value : 4
}

export const validateQuickSetup = ({ quickSetupBatchSize, quickSetupTotalBatches, remainingCount }) => {
  const nextBatchSize = Number(quickSetupBatchSize.value)
  const nextTotalBatches = Number(quickSetupTotalBatches.value)

  if (!Number.isFinite(nextBatchSize) || nextBatchSize <= 0) return warnInvalidSetup('每轮抽取人数必须大于 0')
  if (nextBatchSize > remainingCount.value) return warnInvalidSetup(`剩余可抽人数为 ${remainingCount.value} 人，请调小每轮抽取人数`)
  if (!Number.isFinite(nextTotalBatches) || nextTotalBatches <= 0) return warnInvalidSetup('抽取轮数必须大于 0')

  return { nextBatchSize, nextTotalBatches }
}

const setAriaLabel = (selector, label) => {
  document.querySelectorAll(selector).forEach((button) => {
    button.setAttribute('aria-label', label)
  })
}

const warnInvalidSetup = (message) => {
  ElMessage.warning(message)
  return null
}
