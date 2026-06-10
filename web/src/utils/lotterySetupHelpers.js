import { ElMessage } from 'element-plus'
import { createPrizeItem, getPrizePlanWinnerCount, getValidPrizeItems } from './prizePlan'
import { getStoredQuickSetupPrizeItems } from './quickSetupStorage'

export const syncLocalizedNumberControls = async (nextTick) => {
  await nextTick()
  setAriaLabel('.tech-drawer .el-input-number__decrease', '减少数字')
  setAriaLabel('.tech-drawer .el-input-number__increase', '增加数字')
  setAriaLabel('.quick-setup-dialog .el-input-number__decrease', '减少数字')
  setAriaLabel('.quick-setup-dialog .el-input-number__increase', '增加数字')
}

export const resetQuickSetupPrizeItems = ({ prizeItems, quickSetupPrizeItems }) => {
  const validItems = getValidPrizeItems(prizeItems.value)
  const storedItems = validItems.length > 0 ? [] : getStoredQuickSetupPrizeItems()
  const sourceItems = validItems.length > 0 ? validItems : storedItems

  quickSetupPrizeItems.value = sourceItems.length > 0
    ? sourceItems.map(item => createPrizeItem(item))
    : [createPrizeItem({ name: '一等奖', drawSize: 1, drawTimes: 1 })]
}

export const validateQuickSetupPrizeItems = ({ quickSetupPrizeItems, remainingCount }) => {
  const validItems = getValidPrizeItems(quickSetupPrizeItems.value)

  if (validItems.length === 0) return warnInvalidSetup('请至少填写一个有效奖项')
  const capacityWarning = getPrizeItemsCapacityWarning(validItems, remainingCount.value)
  if (capacityWarning) return warnInvalidSetup(capacityWarning)

  return validItems.map(item => createPrizeItem(item))
}

export const getPrizeItemsCapacityWarning = (items, availableCount) => {
  const validItems = getValidPrizeItems(items)
  const oversizedItem = validItems.find(item => item.drawSize > availableCount)
  if (oversizedItem) return `${oversizedItem.name} 每次需要 ${oversizedItem.drawSize} 人，当前剩余 ${availableCount} 人`

  const plannedWinnerCount = getPrizePlanWinnerCount(validItems)
  if (plannedWinnerCount > availableCount) return `奖项共需 ${plannedWinnerCount} 人，当前剩余 ${availableCount} 人`

  return ''
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
