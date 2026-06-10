const NUMBERED_RESULT_NAME_PATTERN = /^([1-9]\d?)(\D.*)$/u

export const parseResultDisplayName = (value) => {
  const raw = String(value ?? '')
  const match = raw.match(NUMBERED_RESULT_NAME_PATTERN)

  if (!match) {
    return {
      raw,
      isNumbered: false,
      number: '',
      personName: raw,
      styleName: raw,
      ariaLabel: raw
    }
  }

  const personName = match[2].trim()
  if (!personName) {
    return {
      raw,
      isNumbered: false,
      number: '',
      personName: raw,
      styleName: raw,
      ariaLabel: raw
    }
  }

  return {
    raw,
    isNumbered: true,
    number: match[1],
    personName,
    styleName: personName,
    ariaLabel: `${match[1]} ${personName}`
  }
}
