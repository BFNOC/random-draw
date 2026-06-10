import { createPrizeItem, getValidPrizeItems } from './prizePlan'

const QUICK_SETUP_STORAGE_KEY = 'chouqian.quickSetupPrizeItems.v1'

export const getStoredQuickSetupPrizeItems = () => {
  const storage = getLocalStorage()
  if (!storage) return []

  try {
    const rawValue = storage.getItem(QUICK_SETUP_STORAGE_KEY)
    if (!rawValue) return []

    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) return []

    return getValidPrizeItems(parsedValue).map(item => createPrizeItem(item))
  } catch (error) {
    console.warn('读取本地抽奖设置失败', error)
    return []
  }
}

export const hasStoredQuickSetupPrizeItems = () => {
  return getStoredQuickSetupPrizeItems().length > 0
}

export const saveQuickSetupPrizeItems = (items) => {
  const storage = getLocalStorage()
  if (!storage) return false

  try {
    const persistedItems = getValidPrizeItems(items).map(({ name, drawSize, drawTimes }) => ({
      name,
      drawSize,
      drawTimes
    }))

    storage.setItem(QUICK_SETUP_STORAGE_KEY, JSON.stringify(persistedItems))
    return true
  } catch (error) {
    console.warn('保存本地抽奖设置失败', error)
    return false
  }
}

export const clearStoredQuickSetupPrizeItems = () => {
  const storage = getLocalStorage()
  if (!storage) return false

  try {
    storage.removeItem(QUICK_SETUP_STORAGE_KEY)
    return true
  } catch (error) {
    console.warn('清除本地抽奖设置失败', error)
    return false
  }
}

const getLocalStorage = () => {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch (error) {
    console.warn('浏览器本地存储不可用', error)
    return null
  }
}
