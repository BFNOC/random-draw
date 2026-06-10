import { ElMessage } from 'element-plus'
import { createPrizeItem } from './prizePlan'

export const syncLocalizedNumberControls = async (nextTick) => {
  await nextTick()
  setAriaLabel('.tech-drawer .el-input-number__decrease', '减少数字')
  setAriaLabel('.tech-drawer .el-input-number__increase', '增加数字')
  setAriaLabel('.quick-setup-dialog .el-input-number__decrease', '减少数字')
  setAriaLabel('.quick-setup-dialog .el-input-number__increase', '增加数字')
}

export const resetQuickSetupValues = ({ nameList, prizeItems, quickSetupDrawSize, quickSetupDrawTimes, quickSetupPrizeName }) => {
  const firstPrize = prizeItems.value[0] || createPrizeItem({ name: '一等奖' })
  quickSetupPrizeName.value = firstPrize.name || '一等奖'
  quickSetupDrawSize.value = firstPrize.drawSize > 0 ? firstPrize.drawSize : Math.min(50, Math.max(1, nameList.value.length))
  quickSetupDrawTimes.value = firstPrize.drawTimes > 0 ? firstPrize.drawTimes : 1
}

export const validateQuickSetup = ({ quickSetupDrawSize, quickSetupDrawTimes, quickSetupPrizeName, remainingCount }) => {
  const prizeName = String(quickSetupPrizeName.value || '').trim()
  const nextDrawSize = Number(quickSetupDrawSize.value)
  const nextDrawTimes = Number(quickSetupDrawTimes.value)

  if (!prizeName) return warnInvalidSetup('奖项名称不能为空')
  if (!Number.isFinite(nextDrawSize) || nextDrawSize <= 0) return warnInvalidSetup('每次抽取人数必须大于 0')
  if (nextDrawSize > remainingCount.value) return warnInvalidSetup(`剩余可抽人数为 ${remainingCount.value} 人，请调小每次抽取人数`)
  if (!Number.isFinite(nextDrawTimes) || nextDrawTimes <= 0) return warnInvalidSetup('抽取次数必须大于 0')

  return {
    prizeName,
    nextDrawSize: Math.floor(nextDrawSize),
    nextDrawTimes: Math.floor(nextDrawTimes)
  }
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
