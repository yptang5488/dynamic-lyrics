export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00'
  }

  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remainingSeconds = whole % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}
