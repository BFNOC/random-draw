import { FULL_GRID_FILL_CONFIGS } from '../constants/lottery'

const gridRules = [
  { max: 1, columns: 1, rows: 1 },
  { max: 2, columns: 2, rows: 1 },
  { max: 4, columns: 2, rows: 2 },
  { max: 6, columns: 3, rows: 2 },
  { max: 8, columns: 4, rows: 2 },
  { max: 12, columns: 4, rows: 3 },
  { max: 16, columns: 4, rows: 4 },
  { max: 20, columns: 5, rows: 4 },
  { max: 25, columns: 5, rows: 5 },
  { max: 30, columns: 6, rows: 5 },
  { max: 36, columns: 6, rows: 6 },
  { max: 40, columns: 8, rows: 5 },
  { max: 42, columns: 7, rows: 6 },
  { max: 49, columns: 7, rows: 7 },
  { max: 50, columns: 10, rows: 5 }
]

const getGridDimensions = (count) => {
  const rule = gridRules.find(item => count <= item.max)
  if (rule) return { columns: rule.columns, rows: rule.rows }

  return {
    columns: Math.ceil(Math.sqrt(count * 1.6)),
    rows: Math.ceil(count / Math.ceil(Math.sqrt(count * 1.6)))
  }
}

export const getGridStyleByCount = (count) => {
  if (count === 0) return {}

  const { columns, rows } = getGridDimensions(count)

  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    gap: count <= 4 ? '22px' : count <= 12 ? '18px' : count <= 30 ? '12px' : '8px',
    width: '100%',
    height: '100%'
  }
}

export const getNameCardStyleByCount = (count) => {
  if (count === 1) return { fontSize: 'clamp(8rem, 17vw, 22rem)', padding: '3rem' }
  if (count === 2) return { fontSize: 'clamp(6rem, 12vw, 16rem)', padding: '2.5rem' }
  if (count <= 4) return { fontSize: 'clamp(4.8rem, 9vw, 12rem)', padding: '2rem' }
  if (count <= 8) return { fontSize: 'clamp(4rem, 7vw, 9rem)', padding: '1.4rem' }
  if (count <= 9) return { fontSize: 'clamp(3.6rem, 6vw, 8rem)', padding: '1.2rem' }
  if (count <= 12) return { fontSize: 'clamp(3.1rem, 5vw, 6.8rem)', padding: '1rem' }
  if (count <= 16) return { fontSize: 'clamp(2.55rem, 4.25vw, 5.8rem)', padding: '0.9rem' }
  if (count <= 25) return { fontSize: 'clamp(2rem, 3.3vw, 4.5rem)', padding: '0.65rem' }
  if (count <= 36) return { fontSize: 'clamp(1.65rem, 2.65vw, 3.5rem)', padding: '0.55rem' }
  if (count <= 49) return { fontSize: 'clamp(1.45rem, 2.25vw, 3rem)', padding: '0.45rem' }

  return { fontSize: 'clamp(1.35rem, 1.95vw, 2.6rem)', padding: '0.35rem' }
}

const getFullGridNameScale = (count, length) => {
  const config = FULL_GRID_FILL_CONFIGS[count]
  if (!config || length < 2) return null

  const weightedLength = length >= 4 ? Math.min(length + 0.5, 6) : length === 2 ? 2.08 : 3
  const scale = 82 / (config.columns * config.preferredVw * weightedLength)

  return Math.min(2.45, Math.max(0.72, Number(scale.toFixed(2))))
}

export const getNameStyle = (name, count) => {
  if (!name) return {}

  const styles = { ...getNameCardStyleByCount(count) }
  const fullGridScale = getFullGridNameScale(count, name.length)

  if (fullGridScale) {
    styles.fontSize = `calc(${styles.fontSize} * ${fullGridScale})`
    return styles
  }

  if (name.length >= 4) styles.fontSize = `calc(${styles.fontSize} * 0.74)`
  else if (name.length === 3) styles.fontSize = `calc(${styles.fontSize} * 0.9)`
  else if (name.length === 2) styles.fontSize = `calc(${styles.fontSize} * 1.02)`

  return styles
}
