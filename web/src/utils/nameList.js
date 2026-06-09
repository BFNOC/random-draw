export const parseNameList = (input) => {
  if (!input) return []

  return input
    .split('\n')
    .map(name => name.trim())
    .filter(name => name !== '')
}

export const getRemainingNames = (nameList, pickedNames) => {
  return nameList.filter(name => !pickedNames.includes(name))
}

export const shuffleNames = (names) => {
  const shuffled = [...names]

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

export const pickRandomUniqueNames = (poolNames, count) => {
  const pool = [...poolNames]
  const result = []
  const resultCount = Math.min(count, pool.length)

  for (let i = 0; i < resultCount; i += 1) {
    const randomIndex = Math.floor(Math.random() * pool.length)
    result.push(pool.splice(randomIndex, 1)[0])
  }

  return result
}
