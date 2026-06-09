export const sampleNames = (list, limit, randomize = false) => {
  const source = list.filter(Boolean)
  if (source.length <= limit) return randomize ? shuffle(source) : source
  if (randomize) return shuffle(source).slice(0, limit)

  const result = []
  const step = source.length / limit
  for (let i = 0; i < limit; i += 1) {
    result.push(source[Math.floor(i * step)])
  }
  return result
}

export const shuffle = (list) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
