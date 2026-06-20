import assert from 'node:assert/strict'

function getTrimmedDuration(rawDuration, trimStart, trimEnd) {
  if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
    return 0
  }

  return Math.max(0, rawDuration - trimStart - trimEnd)
}

function toVisibleTime(rawTime, trimStart, trimmedDuration) {
  if (!Number.isFinite(rawTime)) {
    return 0
  }

  return Math.min(Math.max(0, rawTime - trimStart), trimmedDuration || 0)
}

function toRawTime(visibleTime, trimStart, trimmedDuration) {
  if (!Number.isFinite(visibleTime)) {
    return trimStart
  }

  return trimStart + Math.min(Math.max(0, visibleTime), trimmedDuration || 0)
}

const duration = getTrimmedDuration(100, 7.5, 2.5)
assert.equal(duration, 90)
assert.equal(toVisibleTime(7.5, 7.5, duration), 0)
assert.equal(toVisibleTime(20, 7.5, duration), 12.5)
assert.equal(toVisibleTime(99, 7.5, duration), 90)
assert.equal(toRawTime(0, 7.5, duration), 7.5)
assert.equal(toRawTime(12.5, 7.5, duration), 20)
assert.equal(toRawTime(120, 7.5, duration), 97.5)
