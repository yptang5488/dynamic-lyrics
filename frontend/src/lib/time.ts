export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00'
  }

  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remainingSeconds = whole % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export function normalizeTrimSeconds(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value || value < 0) {
    return 0
  }

  return value
}

export function getTrimmedDuration(rawDuration: number, trimStart: number, trimEnd: number) {
  if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
    return 0
  }

  return Math.max(0, rawDuration - trimStart - trimEnd)
}

export function toVisibleTime(rawTime: number, trimStart: number, trimmedDuration: number) {
  if (!Number.isFinite(rawTime)) {
    return 0
  }

  return Math.min(Math.max(0, rawTime - trimStart), trimmedDuration || 0)
}

export function toRawTime(visibleTime: number, trimStart: number, trimmedDuration: number) {
  if (!Number.isFinite(visibleTime)) {
    return trimStart
  }

  return trimStart + Math.min(Math.max(0, visibleTime), trimmedDuration || 0)
}
