import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LyricsPanel } from '../components/LyricsPanel'
import { PageShell } from '../components/PageShell'
import { PlayerControls } from '../components/PlayerControls'
import { getSong, resolveMediaUrl, updateSongLyricOffset } from '../lib/api'
import { clearWorkflow } from '../lib/workflow'
import type { SongLyricLine } from '../types/api'

const EMPTY_LYRICS: SongLyricLine[] = []
const OFFSET_RANGE_SECONDS = 10

export function PlayerPage() {
  const { songId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
  const [editedLineNotes, setEditedLineNotes] = useState<Record<string, Array<Record<string, unknown>>>>({})
  const [activeSongId, setActiveSongId] = useState(songId)
  const [syncedOffsetKey, setSyncedOffsetKey] = useState('')

  const songQuery = useQuery({
    queryKey: ['song', songId],
    queryFn: () => getSong(songId),
    enabled: Boolean(songId),
  })
  const lyricOffsetMutation = useMutation({
    mutationFn: (lyricOffset: number) => updateSongLyricOffset(songId, lyricOffset),
    onSuccess: (song) => {
      queryClient.setQueryData(['song', song.id], song)
      setSyncedOffsetKey(buildOffsetKey(song.id, song.lyricOffset))
    },
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

  if (songId !== activeSongId) {
    setActiveSongId(songId)
    setEditedLineNotes({})
    setIsEditingLyrics(false)
    setSelectedEditLineId(null)
    setIsCalibrationOpen(false)
    setTimingOffset(0)
    setDraftTimingOffset(0)
    setSyncedOffsetKey('')
  }

  const savedTimingOffset = roundOffset(songQuery.data?.lyricOffset ?? 0)
  const loadedOffsetKey = songQuery.data?.id === songId ? buildOffsetKey(songQuery.data.id, savedTimingOffset) : ''

  if (loadedOffsetKey && loadedOffsetKey !== syncedOffsetKey && !isCalibrationOpen) {
    setSyncedOffsetKey(loadedOffsetKey)
    setTimingOffset(savedTimingOffset)
    setDraftTimingOffset(savedTimingOffset)
  }

  const baseLyrics = songQuery.data?.lyrics ?? EMPTY_LYRICS
  const originalLyrics = useMemo(() => applyEditedLineNotes(baseLyrics, editedLineNotes), [baseLyrics, editedLineNotes])
  const adjustedLyrics = useMemo(() => shiftLyrics(originalLyrics, timingOffset), [originalLyrics, timingOffset])
  const activeLine = useMemo(() => findActiveLine(adjustedLyrics, currentTime), [adjustedLyrics, currentTime])
  const offsetRangeStart = -OFFSET_RANGE_SECONDS
  const offsetRangeEnd = OFFSET_RANGE_SECONDS
  const offsetTicks = useMemo(() => buildTimeTicks(offsetRangeStart, offsetRangeEnd), [offsetRangeStart, offsetRangeEnd])

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

  function applyDraftOffset(value: number) {
    setDraftTimingOffset(roundOffset(clampOffset(value, offsetRangeStart, offsetRangeEnd)))
  }

  function handleNudgeTiming(delta: number) {
    applyDraftOffset(draftTimingOffset + delta)
  }

  function openCalibrationSettings() {
    setDraftTimingOffset(timingOffset)
    setIsCalibrationOpen(true)
  }

  function applyCalibrationSettings() {
    lyricOffsetMutation.mutate(roundOffset(draftTimingOffset), {
      onSuccess: (song) => {
        const savedOffset = roundOffset(song.lyricOffset)
        setTimingOffset(savedOffset)
        setDraftTimingOffset(savedOffset)
        setIsCalibrationOpen(false)
      },
    })
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

    if (!track) {
      return
    }

    event.preventDefault()
    applyDraftOffset(tickValue)

    const applyPointerOffset = (clientX: number) => {
      const rect = track.getBoundingClientRect()

      if (rect.width <= 0) {
        return
      }

      const ratio = (clientX - rect.left) / rect.width
      const nextOffset = offsetRangeStart + (offsetRangeEnd - offsetRangeStart) * ratio
      applyDraftOffset(nextOffset)
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      applyPointerOffset(moveEvent.clientX)
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
                <h3 id="sync-offset-title">Lyric line offset: {formatSignedSeconds(timingOffset)}</h3>
                <p className="muted">
                  Adjust the whole lyric timeline earlier or later without changing the original LRC timestamps.
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={openCalibrationSettings} disabled={isCalibrationOpen}>
                Calibration settings
              </button>
            </div>
            {isCalibrationOpen ? (
              <div className="sync-offset-tool__controls">
                <input
                  className="seek-input"
                  type="range"
                  min={offsetRangeStart}
                  max={offsetRangeEnd}
                  step={0.1}
                  value={draftTimingOffset}
                  aria-label="Lyric line offset in seconds"
                  onChange={(event) => applyDraftOffset(Number(event.target.value))}
                />
                <div ref={scaleTrackRef} className="sync-offset-tool__ticks" aria-label="Drag a tick left or right to adjust the lyric line offset">
                  <button
                    type="button"
                    className="sync-offset-tool__origin"
                    style={{ left: '50%' }}
                    onClick={() => applyDraftOffset(0)}
                    disabled={draftTimingOffset === 0}
                    aria-label="Reset lyric line offset to original timing"
                  >
                    <span className="sync-offset-tool__origin-line" />
                    <span>original</span>
                  </button>
                  {offsetTicks.filter((tick) => tick.value !== 0).map((tick) => (
                    <span
                      key={tick.value}
                      className={`sync-offset-tool__tick${tick.isLabeled ? ' sync-offset-tool__tick--labeled' : ''}`}
                      style={{ left: `${tick.position}%` }}
                      onPointerDown={(event) => handleTickPointerDown(event, tick.value)}
                    >
                      <span className="sync-offset-tool__tick-mark" />
                      {tick.isLabeled ? <span>{formatSignedSeconds(tick.value)}</span> : null}
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
                    value={draftTimingOffset}
                    aria-label="Lyric line offset in seconds"
                    onChange={(event) => applyDraftOffset(Number(event.target.value))}
                  />
                  <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(0.1)}>+0.1s</button>
                  <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(0.5)}>+0.5s</button>
                </div>
                <div className="sync-offset-tool__actions">
                  <button type="button" className="primary-button" onClick={applyCalibrationSettings} disabled={lyricOffsetMutation.isPending}>
                    {lyricOffsetMutation.isPending ? 'Saving...' : 'Apply calibration'}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => applyDraftOffset(0)} disabled={draftTimingOffset === 0}>
                    Reset offset
                  </button>
                </div>
                {lyricOffsetMutation.isError ? (
                  <div className="error-state">
                    {lyricOffsetMutation.error instanceof Error ? lyricOffsetMutation.error.message : 'Failed to save lyric offset.'}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </section>

        <LyricsPanel
          lyrics={adjustedLyrics}
          activeLineId={activeLine?.id}
          selectedEditLineId={selectedEditLineId}
          showTranslation={showTranslation}
          autoScroll={autoScroll}
          isEditing={isEditingLyrics}
          onSeekToLine={handleSeekToLine}
          onSelectEditLine={handleSelectEditLine}
          onUpdateStandaloneChant={handleUpdateStandaloneChant}
        />
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

function buildOffsetKey(songId: string, lyricOffset: number) {
  return `${songId}:${roundOffset(lyricOffset)}`
}

function clampOffset(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(Math.max(value, minimum), maximum)
}

function formatSignedSeconds(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}s`
}

function buildTimeTicks(start: number, end: number) {
  const range = end - start

  if (!Number.isFinite(range) || range <= 0) {
    return []
  }

  const firstTick = Math.ceil(start)
  const lastTick = Math.floor(end)
  const labelInterval = range <= 24 ? 5 : range <= 70 ? 5 : 10
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
