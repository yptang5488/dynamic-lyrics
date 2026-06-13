import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LyricsPanel } from '../components/LyricsPanel'
import { PageShell } from '../components/PageShell'
import { PlayerControls } from '../components/PlayerControls'
import { SectionCard } from '../components/SectionCard'
import { getSong, resolveMediaUrl } from '../lib/api'
import { clearWorkflow } from '../lib/workflow'
import type { SongLyricLine } from '../types/api'

export function PlayerPage() {
  const { songId = '' } = useParams()
  const navigate = useNavigate()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scaleTrackRef = useRef<HTMLDivElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showTranslation, setShowTranslation] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [selectedEditLineId, setSelectedEditLineId] = useState<string | null>(null)
  const [timingOffset, setTimingOffset] = useState(0)
  const [draftTimingOffset, setDraftTimingOffset] = useState(0)
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false)
  const [calibrationWindowSeconds, setCalibrationWindowSeconds] = useState(10)
  const [editedLineNotes, setEditedLineNotes] = useState<Record<string, Array<Record<string, unknown>>>>({})

  const songQuery = useQuery({
    queryKey: ['song', songId],
    queryFn: () => getSong(songId),
    enabled: Boolean(songId),
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration || 0)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [songQuery.data?.id])

  const baseLyrics = songQuery.data?.lyrics ?? []
  const originalLyrics = useMemo(() => applyEditedLineNotes(baseLyrics, editedLineNotes), [baseLyrics, editedLineNotes])
  const adjustedLyrics = useMemo(() => shiftLyrics(originalLyrics, timingOffset), [originalLyrics, timingOffset])
  const activeLine = useMemo(() => findActiveLine(adjustedLyrics, currentTime), [adjustedLyrics, currentTime])
  const anchorLine = originalLyrics[0]
  const calibrationDuration = duration || songQuery.data?.audio.duration || 0
  const calibrationOffset = isCalibrationOpen ? draftTimingOffset : timingOffset
  const anchorTargetTime = anchorLine ? roundOffset(anchorLine.start + calibrationOffset) : 0
  const anchorRangeStart = anchorLine ? roundOffset(anchorLine.start - calibrationWindowSeconds) : 0
  const anchorRangeEnd = anchorLine ? roundOffset(anchorLine.start + calibrationWindowSeconds) : 0
  const anchorTicks = useMemo(() => buildTimeTicks(anchorRangeStart, anchorRangeEnd), [anchorRangeStart, anchorRangeEnd])

  useEffect(() => {
    setEditedLineNotes({})
    setIsEditingLyrics(false)
    setSelectedEditLineId(null)
    setIsCalibrationOpen(false)
    setTimingOffset(0)
    setDraftTimingOffset(0)
  }, [songQuery.data?.id])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (audio.paused) {
      void audio.play()
      return
    }

    audio.pause()
  }

  function handleSeek(value: number) {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.currentTime = value
    setCurrentTime(value)
  }

  function handleSeekToLine(line: SongLyricLine) {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!audio.paused) {
      audio.pause()
      return
    }

    audio.currentTime = line.start
    setCurrentTime(line.start)
    void audio.play()
  }

  function previewPlaybackAt(value: number) {
    const audio = audioRef.current
    const nextTime = clampTime(value, calibrationDuration)

    if (!audio) {
      return
    }

    audio.currentTime = nextTime
    setCurrentTime(nextTime)
    void audio.play()
  }

  function applyAnchorStartTime(value: number, anchor = anchorLine) {
    if (!anchor) {
      return
    }

    const nextTime = roundOffset(value)
    const nextOffset = roundOffset(nextTime - anchor.start)

    if (isCalibrationOpen) {
      setDraftTimingOffset(nextOffset)
    } else {
      setTimingOffset(nextOffset)
    }

    previewPlaybackAt(nextTime)
  }

  function handleNudgeTiming(delta: number) {
    if (!anchorLine) {
      return
    }

    applyAnchorStartTime(anchorLine.start + calibrationOffset + delta)
  }

  function openCalibrationSettings() {
    setDraftTimingOffset(timingOffset)
    setIsCalibrationOpen(true)
  }

  function applyCalibrationSettings() {
    setTimingOffset(draftTimingOffset)
    setIsCalibrationOpen(false)
  }

  function handleSelectEditLine(line: SongLyricLine) {
    setSelectedEditLineId(line.id)
  }

  function handleUpdateStandaloneChant(line: SongLyricLine, noteIndex: number, text: string) {
    setEditedLineNotes((current) => {
      const baseLine = baseLyrics.find((item) => item.id === line.id)
      const currentNotes = current[line.id] ?? baseLine?.notes

      if (!currentNotes?.[noteIndex]) {
        return current
      }

      const nextNotes = [...currentNotes]
      nextNotes[noteIndex] = { ...nextNotes[noteIndex], text }

      return { ...current, [line.id]: nextNotes }
    })
  }

  function handleTickPointerDown(event: ReactPointerEvent<HTMLSpanElement>, tickValue: number) {
    const track = scaleTrackRef.current
    const anchorStart = anchorLine?.start

    if (!track || anchorStart === undefined) {
      return
    }

    const tickDistance = Math.abs(tickValue - anchorStart)

    if (tickDistance < 0.01) {
      return
    }

    event.preventDefault()

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = track.getBoundingClientRect()
      const halfWidth = rect.width / 2

      if (halfWidth <= 0) {
        return
      }

      const centerX = rect.left + halfWidth
      const distanceFromCenter = Math.min(halfWidth, Math.abs(moveEvent.clientX - centerX))
      const ratio = Math.max(0.04, distanceFromCenter / halfWidth)
      setCalibrationWindowSeconds(roundOffset(clampScaleWindow(tickDistance / ratio, Math.abs(calibrationOffset) + 0.1)))
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  if (songQuery.isLoading) {
    return (
      <PageShell
        eyebrow="Player"
        title="Loading player"
        subtitle="Fetching the timed lyric payload for this learning session."
      />
    )
  }

  if (songQuery.isError || !songQuery.data) {
    return (
      <PageShell
        eyebrow="Player"
        title="Player unavailable"
        subtitle="The requested song payload could not be loaded from the backend."
        aside={<Link className="secondary-button" to="/">Back to library</Link>}
      >
        <div className="error-state">{songQuery.error instanceof Error ? songQuery.error.message : 'Song not found.'}</div>
      </PageShell>
    )
  }

  const song = songQuery.data

  return (
    <PageShell
      eyebrow="Learning Player"
      title={song.title}
      subtitle="Use line-level sync to rehearse the song, reveal or hide translations, and jump directly from the lyric list."
      aside={<Link className="secondary-button" to="/">Back to library</Link>}
    >
      <div className="page-grid">
        <section className="player-card">
          <div className="player-topline">
            <div className="player-meta">
              <span className="eyebrow">Now studying</span>
              <h2>{song.artist}</h2>
              <p className="muted">Source id: <span className="inline-code">{song.audio.sourceId}</span></p>
            </div>
            <div className="mode-bar">
              <button
                type="button"
                className={`chip-button${showTranslation ? ' is-active' : ''}`}
                onClick={() => setShowTranslation((value) => !value)}
              >
                Translation {showTranslation ? 'on' : 'off'}
              </button>
              <button
                type="button"
                className={`chip-button${autoScroll ? ' is-active' : ''}`}
                onClick={() => setAutoScroll((value) => !value)}
              >
                Auto-scroll {autoScroll ? 'on' : 'off'}
              </button>
              <button
                type="button"
                className={`chip-button${isEditingLyrics ? ' is-active' : ''}`}
                onClick={() => {
                  setIsEditingLyrics((value) => !value)
                  setSelectedEditLineId(null)
                }}
              >
                {isEditingLyrics ? 'Done editing' : 'Edit lyrics'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  clearWorkflow()
                  navigate('/')
                }}
              >
                Reset flow
              </button>
            </div>
          </div>

          <audio ref={audioRef} src={resolveMediaUrl(song.audio.playbackUrl)} preload="metadata" />
          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration || song.audio.duration || 0}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
          />
          <section className="sync-offset-tool" aria-labelledby="sync-offset-title">
            <div className="sync-offset-tool__header">
              <div>
                <div className="eyebrow">LRC start calibration</div>
                <h3 id="sync-offset-title">First lyric line offset: {formatSignedSeconds(timingOffset)}</h3>
                <p className="muted">
                  Calibration uses the first lyric line as the timing reference. Open settings only when the LRC start needs adjustment.
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={openCalibrationSettings} disabled={!anchorLine || isCalibrationOpen}>
                Calibration settings
              </button>
            </div>
            {isCalibrationOpen ? (
              <div className="sync-offset-tool__controls">
                <div className="sync-offset-tool__summary">
                  <span>Original LRC start: <strong>{anchorLine ? formatPreciseTime(anchorLine.start) : '00:00.0'}</strong></span>
                  <span>Preview start: <strong>{formatPreciseTime(anchorTargetTime)}</strong></span>
                  <span>Draft shift: <strong>{formatSignedSeconds(draftTimingOffset)}</strong></span>
                </div>
                <input
                  className="seek-input"
                  type="range"
                  min={anchorRangeStart}
                  max={anchorRangeEnd}
                  step={0.1}
                  value={anchorTargetTime}
                  aria-label="First lyric start time in audio"
                  disabled={!anchorLine}
                  onChange={(event) => applyAnchorStartTime(Number(event.target.value))}
                />
                <div ref={scaleTrackRef} className="sync-offset-tool__ticks" aria-label="Drag a tick left or right to resize the calibration range">
                  <button
                    type="button"
                    className="sync-offset-tool__origin"
                    style={{ left: '50%' }}
                    onClick={() => applyAnchorStartTime(anchorLine?.start ?? 0)}
                    disabled={!anchorLine || draftTimingOffset === 0}
                    aria-label="Reset reference lyric to its original LRC time"
                  >
                    <span className="sync-offset-tool__origin-line" />
                    <span>Original</span>
                  </button>
                  {anchorTicks.map((tick) => (
                    <span
                      key={tick.value}
                      className={`sync-offset-tool__tick${tick.isLabeled ? ' sync-offset-tool__tick--labeled' : ''}`}
                      style={{ left: `${tick.position}%` }}
                      onPointerDown={(event) => handleTickPointerDown(event, tick.value)}
                    >
                      <span className="sync-offset-tool__tick-mark" />
                      {tick.isLabeled ? <span>{formatWholeTime(tick.value)}</span> : null}
                    </span>
                  ))}
                </div>
                <div className="sync-offset-tool__actions">
                  <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(-0.5)}>-0.5s</button>
                  <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(-0.1)}>-0.1s</button>
                  <input
                    className="field sync-offset-tool__input"
                    type="number"
                    step={0.1}
                    value={anchorTargetTime}
                    aria-label="First lyric start time in audio seconds"
                    disabled={!anchorLine}
                    onChange={(event) => applyAnchorStartTime(Number(event.target.value))}
                  />
                  <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(0.1)}>+0.1s</button>
                  <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(0.5)}>+0.5s</button>
                </div>
                <div className="sync-offset-tool__actions">
                  <button type="button" className="primary-button" onClick={applyCalibrationSettings} disabled={!anchorLine}>
                    Apply calibration
                  </button>
                  <button type="button" className="ghost-button" onClick={() => applyAnchorStartTime(anchorLine?.start ?? 0)} disabled={draftTimingOffset === 0 || !anchorLine}>
                    Reset offset
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </section>

        <div className="split-grid">
          <LyricsPanel
            lyrics={adjustedLyrics}
            activeLineId={activeLine?.id}
            selectedEditLineId={selectedEditLineId}
            showTranslation={showTranslation}
            autoScroll={autoScroll}
            isEditing={isEditingLyrics}
            timingOffset={timingOffset}
            onSeekToLine={handleSeekToLine}
            onSelectEditLine={handleSelectEditLine}
            onUpdateStandaloneChant={handleUpdateStandaloneChant}
          />

          <SectionCard title="Learning focus" subtitle="Phase 1 uses line timing, but the player already reflects the future guided-learning workflow.">
            <div className="quick-list">
              <div className="metric">
                <strong>Current line</strong>
                <span className="muted">{activeLine?.text ?? 'Start playback to activate a lyric line.'}</span>
              </div>
              <div className="metric">
                <strong>Translation mode</strong>
                <span className="muted">{showTranslation ? 'Visible for assisted learning.' : 'Hidden for focus mode.'}</span>
              </div>
              <div className="metric">
                <strong>Upcoming expansion</strong>
                <span className="muted">Word-level notes and cheering cues can reuse this same panel in later phases.</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  )
}

function findActiveLine(lines: SongLyricLine[], currentTime: number) {
  return (
    lines.find((line) => currentTime >= line.start && currentTime <= line.end) ??
    lines.find((line) => currentTime < line.start)
  )
}

function applyEditedLineNotes(
  lines: SongLyricLine[],
  editedLineNotes: Record<string, Array<Record<string, unknown>>>,
): SongLyricLine[] {
  if (Object.keys(editedLineNotes).length === 0) {
    return lines
  }

  return lines.map((line) => {
    const notes = editedLineNotes[line.id]

    if (!notes) {
      return line
    }

    return { ...line, notes }
  })
}

function shiftLyrics(lines: SongLyricLine[], offset: number): SongLyricLine[] {
  if (offset === 0) {
    return lines
  }

  return lines.map((line) => {
    const start = Math.max(0, line.start + offset)
    const end = Math.max(start + 0.1, line.end + offset)

    return { ...line, start, end }
  })
}

function roundOffset(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 10) / 10
}

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, value)
  }

  return Math.min(Math.max(0, value), duration)
}

function formatSignedSeconds(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}s`
}

function formatPreciseTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00.0'
  }

  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remainingSeconds = whole % 60
  const tenths = Math.floor((seconds - whole) * 10)
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${tenths}`
}

function formatWholeTime(seconds: number) {
  const whole = Math.abs(Math.round(seconds))
  const minutes = Math.floor(whole / 60)
  const remainingSeconds = whole % 60
  const prefix = seconds < 0 ? '-' : ''
  return `${prefix}${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function buildTimeTicks(start: number, end: number) {
  const range = end - start

  if (!Number.isFinite(range) || range <= 0) {
    return []
  }

  const firstTick = Math.ceil(start)
  const lastTick = Math.floor(end)
  const labelInterval = range <= 24 ? 1 : range <= 70 ? 5 : 10
  const ticks = []

  for (let value = firstTick; value <= lastTick; value += 1) {
    ticks.push({
      value,
      position: ((value - start) / range) * 100,
      isLabeled: value % labelInterval === 0,
    })
  }

  return ticks
}

function clampScaleWindow(value: number, minimum = 2) {
  if (!Number.isFinite(value)) {
    return 10
  }

  return Math.min(Math.max(value, minimum, 2), 120)
}
