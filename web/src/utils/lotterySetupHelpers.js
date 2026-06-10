import { ElMessage } from 'element-plus'
import { createPrizeItem, getValidPrizeItems } from './prizePlan'

export const syncLocalizedNumberControls = async (nextTick) => {
  await nextTick()
  setAriaLabel('.tech-drawer .el-input-number__decrease', '减少数字')
  setAriaLabel('.tech-drawer .el-input-number__increase', '增加数字')
  setAriaLabel('.quick-setup-dialog .el-input-number__decrease', '减少数字')
  setAriaLabel('.quick-setup-dialog .el-input-number__increase', '增加数字')
}

export const resetQuickSetupPrizeItems = ({ prizeItems, quickSetupPrizeItems }) => {
  const validItems = getValidPrizeItems(prizeItems.value)
  quickSetupPrizeItems.value = validItems.length > 0
    ? validItems.map(item => createPrizeItem(item))
    : [createPrizeItem({ name: '一等奖', drawSize: 1, drawTimes: 1 })]
}

export const validateQuickSetupPrizeItems = ({ quickSetupPrizeItems, remainingCount }) => {
  const validItems = getValidPrizeItems(quickSetupPrizeItems.value)

  if (validItems.length === 0) return warnInvalidSetup('请至少填写一个有效奖项')
  const oversizedItem = validItems.find(item => item.drawSize > remainingCount.value)
  if (oversizedItem) {
    return warnInvalidSetup(`${oversizedItem.name} 每次需要 ${oversizedItem.drawSize} 人，当前剩余 ${remainingCount.value} 人`)
  }

  return validItems.map(item => createPrizeItem(item))
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
