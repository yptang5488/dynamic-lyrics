import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { LyricsPanel } from '../components/LyricsPanel'
import { PageShell } from '../components/PageShell'
import { PlayerControls } from '../components/PlayerControls'
import { getSong, resolveMediaUrl, shiftSongTiming, updateSongChantEvents, updateSongLyricNotes, updateSongLyricOffset, updateSongMetadata } from '../lib/api'
import { IS_PRACTICE_MODE } from '../lib/practiceMode'
import { getTrimmedDuration, normalizeTrimSeconds, toRawTime, toVisibleTime } from '../lib/time'
import type { SongChantEvent, SongLyricLine } from '../types/api'

const EMPTY_LYRICS: SongLyricLine[] = []
const EMPTY_CHANT_EVENTS: SongChantEvent[] = []
export function PlayerPage() {
  const { songId = '' } = useParams()
  const queryClient = useQueryClient()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [rawDuration, setRawDuration] = useState(0)
  const [showTranslation, setShowTranslation] = useState(true)
  const [showChantRomanization, setShowChantRomanization] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [selectedEditLineId, setSelectedEditLineId] = useState<string | null>(null)
  const [timingOffset, setTimingOffset] = useState(0)
  const [draftTimingOffset, setDraftTimingOffset] = useState(0)
  const [isCompactCalibrationOpen, setIsCompactCalibrationOpen] = useState(false)
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false)
  const [isTimingShiftOpen, setIsTimingShiftOpen] = useState(false)
  const [draftShiftFromLineId, setDraftShiftFromLineId] = useState('')
  const [draftShiftOffset, setDraftShiftOffset] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftArtist, setDraftArtist] = useState('')
  const [draftTrimStart, setDraftTrimStart] = useState('0')
  const [draftTrimEnd, setDraftTrimEnd] = useState('0')
  const [editedLineNotes, setEditedLineNotes] = useState<Record<string, Array<Record<string, unknown>>>>({})
  const [editedChantEvents, setEditedChantEvents] = useState<SongChantEvent[] | null>(null)
  const [activeSongId, setActiveSongId] = useState(songId)
  const [syncedOffsetKey, setSyncedOffsetKey] = useState('')

  const songQuery = useQuery({
    queryKey: ['song', songId],
    queryFn: () => getSong(songId),
    enabled: Boolean(songId),
  })
  const trimStart = normalizeTrimSeconds(songQuery.data?.audio.trimStart)
  const trimEnd = normalizeTrimSeconds(songQuery.data?.audio.trimEnd)
  const audioDuration = rawDuration || songQuery.data?.audio.duration || 0
  const playbackDuration = getTrimmedDuration(audioDuration, trimStart, trimEnd)
  const trimEndTime = trimStart + playbackDuration
  const lyricOffsetMutation = useMutation({
    mutationFn: (lyricOffset: number) => updateSongLyricOffset(songId, lyricOffset),
    onSuccess: (song) => {
      queryClient.setQueryData(['song', song.id], song)
      setSyncedOffsetKey(buildOffsetKey(song.id, song.lyricOffset))
    },
  })
  const lyricNotesMutation = useMutation({
    mutationFn: ({ lineId, notes }: { lineId: string; notes: Array<Record<string, unknown>> }) => (
      updateSongLyricNotes(songId, [{ lineId, notes }])
    ),
    onSuccess: (song, variables) => {
      queryClient.setQueryData(['song', song.id], song)
      const updatedLine = song.lyrics.find((line) => line.id === variables.lineId)
      if (updatedLine) {
        setEditedLineNotes((current) => ({ ...current, [variables.lineId]: updatedLine.notes }))
      }
    },
  })
  const chantEventsMutation = useMutation({
    mutationFn: (chantEvents: SongChantEvent[]) => updateSongChantEvents(songId, chantEvents),
    onSuccess: (song) => {
      queryClient.setQueryData(['song', song.id], song)
      setEditedChantEvents(song.chantEvents)
    },
  })
  const metadataMutation = useMutation({
    mutationFn: ({ title, artist, trimStart, trimEnd }: { title: string; artist: string; trimStart: number; trimEnd: number }) => updateSongMetadata(songId, title, artist, trimStart, trimEnd),
    onSuccess: (song) => {
      queryClient.setQueryData(['song', song.id], song)
      setDraftTitle(song.title)
      setDraftArtist(song.artist)
      setDraftTrimStart(String(normalizeTrimSeconds(song.audio.trimStart)))
      setDraftTrimEnd(String(normalizeTrimSeconds(song.audio.trimEnd)))
      setIsMetadataEditorOpen(false)
    },
  })
  const timingShiftMutation = useMutation({
    mutationFn: ({ fromLineId, offset }: { fromLineId: string; offset: number }) => shiftSongTiming(songId, fromLineId, offset),
    onSuccess: (song) => {
      queryClient.setQueryData(['song', song.id], song)
      setIsTimingShiftOpen(false)
      setDraftShiftOffset('')
    },
  })

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [songId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => {
      if (playbackDuration > 0 && audio.currentTime >= trimEndTime) {
        audio.currentTime = trimEndTime
        audio.pause()
      }
      setCurrentTime(toVisibleTime(audio.currentTime, trimStart, playbackDuration))
    }
    const handleLoadedMetadata = () => {
      setRawDuration(audio.duration || 0)
      if (trimStart > 0 && audio.currentTime < trimStart) {
        audio.currentTime = trimStart
      }
      setCurrentTime(toVisibleTime(audio.currentTime, trimStart, getTrimmedDuration(audio.duration || 0, trimStart, trimEnd)))
    }
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
  }, [playbackDuration, songQuery.data?.id, trimEnd, trimEndTime, trimStart])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !songQuery.data) {
      return
    }

    if (audio.currentTime < trimStart) {
      audio.currentTime = trimStart
    } else if (playbackDuration > 0 && audio.currentTime > trimEndTime) {
      audio.currentTime = trimEndTime
    }

    setCurrentTime(toVisibleTime(audio.currentTime, trimStart, playbackDuration))
  }, [playbackDuration, songQuery.data, trimEndTime, trimStart])

  if (songId !== activeSongId) {
    setActiveSongId(songId)
    setEditedLineNotes({})
    setEditedChantEvents(null)
    setIsEditingLyrics(false)
    setSelectedEditLineId(null)
    setIsCompactCalibrationOpen(false)
    setIsMetadataEditorOpen(false)
    setIsTimingShiftOpen(false)
    setDraftShiftFromLineId('')
    setDraftShiftOffset('')
    setDraftTitle('')
    setDraftArtist('')
    setDraftTrimStart('0')
    setDraftTrimEnd('0')
    setRawDuration(0)
    setCurrentTime(0)
    setTimingOffset(0)
    setDraftTimingOffset(0)
    setSyncedOffsetKey('')
  }

  const savedTimingOffset = roundOffset(songQuery.data?.lyricOffset ?? 0)
  const loadedOffsetKey = songQuery.data?.id === songId ? buildOffsetKey(songQuery.data.id, savedTimingOffset) : ''

  if (loadedOffsetKey && loadedOffsetKey !== syncedOffsetKey && !isCompactCalibrationOpen) {
    setSyncedOffsetKey(loadedOffsetKey)
    setTimingOffset(savedTimingOffset)
    setDraftTimingOffset(savedTimingOffset)
  }

  const baseLyrics = songQuery.data?.lyrics ?? EMPTY_LYRICS
  const baseChantEvents = editedChantEvents ?? songQuery.data?.chantEvents ?? EMPTY_CHANT_EVENTS
  const originalLyrics = useMemo(() => applyEditedLineNotes(baseLyrics, editedLineNotes), [baseLyrics, editedLineNotes])
  const adjustedLyrics = useMemo(() => shiftLyrics(originalLyrics, timingOffset), [originalLyrics, timingOffset])
  const adjustedChantEvents = useMemo(() => shiftChantEvents(baseChantEvents, timingOffset), [baseChantEvents, timingOffset])
  const hasTranslation = originalLyrics.some((line) => Boolean(line.translation?.trim()))
  const activeLine = useMemo(() => findActiveLine(adjustedLyrics, currentTime), [adjustedLyrics, currentTime])
  const activeChantEvent = useMemo(() => activeLine ? undefined : findActiveChantEvent(adjustedChantEvents, currentTime), [activeLine, adjustedChantEvents, currentTime])
  function togglePlay() {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (audio.paused) {
      if (audio.currentTime < trimStart || (playbackDuration > 0 && audio.currentTime >= trimEndTime)) {
        audio.currentTime = trimStart
      }
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

    audio.currentTime = toRawTime(value, trimStart, playbackDuration)
    setCurrentTime(value)
  }

  function handleSeekToLine(line: SongLyricLine) {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.currentTime = toRawTime(line.start, trimStart, playbackDuration)
    setCurrentTime(line.start)
    void audio.play()
  }

  function handleSeekToChantEvent(event: SongChantEvent) {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.currentTime = toRawTime(event.start, trimStart, playbackDuration)
    setCurrentTime(event.start)
    void audio.play()
  }

  function applyDraftOffset(value: number) {
    setDraftTimingOffset(roundOffset(value))
  }

  function handleNudgeTiming(delta: number) {
    applyDraftOffset(draftTimingOffset + delta)
  }

  function toggleLyricsEditing() {
    setIsEditingLyrics((value) => !value)
    setSelectedEditLineId(null)
  }

  function toggleCompactCalibrationSettings() {
    setDraftTimingOffset(timingOffset)
    setIsMetadataEditorOpen(false)
    setIsTimingShiftOpen(false)
    setIsCompactCalibrationOpen((value) => !value)
  }

  function toggleMetadataEditor() {
    const song = songQuery.data
    if (!song) {
      return
    }

    setDraftTitle(song.title)
    setDraftArtist(song.artist)
    setDraftTrimStart(String(normalizeTrimSeconds(song.audio.trimStart)))
    setDraftTrimEnd(String(normalizeTrimSeconds(song.audio.trimEnd)))
    setIsCompactCalibrationOpen(false)
    setIsTimingShiftOpen(false)
    setIsMetadataEditorOpen((value) => !value)
  }

  function toggleTimingShiftTool() {
    setIsCompactCalibrationOpen(false)
    setIsMetadataEditorOpen(false)
    setDraftShiftFromLineId((value) => value || activeLine?.id || '')
    setIsTimingShiftOpen((value) => !value)
  }

  function saveMetadata() {
    metadataMutation.mutate({
      title: draftTitle.trim(),
      artist: draftArtist.trim(),
      trimStart: parseTrimDraft(draftTrimStart),
      trimEnd: parseTrimDraft(draftTrimEnd),
    })
  }

  function applyCalibrationSettings() {
    lyricOffsetMutation.mutate(roundOffset(draftTimingOffset), {
      onSuccess: (song) => {
        const savedOffset = roundOffset(song.lyricOffset)
        setTimingOffset(savedOffset)
        setDraftTimingOffset(savedOffset)
        setIsCompactCalibrationOpen(false)
      },
    })
  }

  function applyTimingShift() {
    const fromLineId = draftShiftFromLineId.trim()
    const offset = parseShiftOffset(draftShiftOffset)
    if (!fromLineId || offset === null) {
      return
    }

    timingShiftMutation.mutate({ fromLineId, offset })
  }

  function handleSelectEditLine(line: SongLyricLine) {
    setSelectedEditLineId(line.id)
  }

  function handleUpdateChantText(line: SongLyricLine, noteIndex: number, text: string) {
    updateNotesForLine(line, (notes) => {
      if (!notes[noteIndex]) {
        return notes
      }

      const nextNotes = [...notes]
      const nextNote = { ...nextNotes[noteIndex] }
      delete nextNote.romanizedText
      nextNotes[noteIndex] = { ...nextNote, text }
      return nextNotes
    })
  }

  function handleDeleteChantNote(line: SongLyricLine, noteIndex: number) {
    updateNotesForLine(line, (notes) => notes.filter((_, index) => index !== noteIndex))
  }

  function handleAddChantNote(line: SongLyricLine, note: Record<string, unknown>) {
    updateNotesForLine(line, (notes) => [...notes, note])
  }

  function handleSaveChantEvents(events: SongChantEvent[]) {
    const nextEvents = shiftChantEvents(events, -timingOffset, false).sort((left, right) => left.start - right.start)
    setEditedChantEvents(nextEvents)
    chantEventsMutation.mutate(nextEvents)
  }

  function updateNotesForLine(
    line: SongLyricLine,
    updater: (notes: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
  ) {
    const baseLine = baseLyrics.find((item) => item.id === line.id)
    const currentNotes = editedLineNotes[line.id] ?? baseLine?.notes

    if (!currentNotes) {
      return
    }

    const nextNotes = updater(currentNotes)
    setEditedLineNotes((current) => ({ ...current, [line.id]: nextNotes }))
    lyricNotesMutation.mutate({ lineId: line.id, notes: nextNotes })
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
  const canSaveMetadata = draftTitle.trim().length > 0
    && draftArtist.trim().length > 0
    && isValidTrimDraft(draftTrimStart)
    && isValidTrimDraft(draftTrimEnd)
    && !metadataMutation.isPending
  const activeBaseLine = activeLine ? originalLyrics.find((line) => line.id === activeLine.id) : undefined
  const shiftOffset = parseShiftOffset(draftShiftOffset)
  const shiftPreview = shiftOffset === null ? null : buildShiftPreview(originalLyrics, draftShiftFromLineId.trim(), shiftOffset)
  const canApplyTimingShift = Boolean(shiftPreview) && !shiftPreview?.hasNegativeTime && !timingShiftMutation.isPending

  return (
    <PageShell
      eyebrow="Learning Player"
      title={song.title}
      subtitle="Use line-level sync to rehearse the song, reveal or hide translations, and jump directly from the lyric list."
      hideHeader
    >
      <div className="page-grid">
        <section className={`player-hero${isCompactCalibrationOpen || isMetadataEditorOpen || isTimingShiftOpen ? ' player-hero--popover-open' : ''}`} aria-label="Playback controls">
          <Link className="player-hero__back" to="/" aria-label="Back to library">
            <span aria-hidden="true">←</span>
            <span>Back to library</span>
          </Link>
          <audio ref={audioRef} src={resolveMediaUrl(song.audio.playbackUrl)} preload="metadata" />
          <PlayerControls
            title={song.title}
            artist={song.artist}
            actions={(
              <div className="player-toolbar-actions">
                {!IS_PRACTICE_MODE ? <div className="player-calibration">
                  <button
                    type="button"
                    className="secondary-button player-calibration__toggle"
                    onClick={toggleMetadataEditor}
                    aria-expanded={isMetadataEditorOpen}
                    aria-controls="song-metadata-editor"
                  >
                    Edit details
                  </button>
                  {isMetadataEditorOpen ? (
                    <div id="song-metadata-editor" className="player-calibration__panel">
                      <label>
                        <span className="field-label">Song title</span>
                        <input className="field" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                      </label>
                      <label>
                        <span className="field-label">Artist</span>
                        <input className="field" value={draftArtist} onChange={(event) => setDraftArtist(event.target.value)} />
                      </label>
                      <label>
                        <span className="field-label">Trim start seconds</span>
                        <input className="field" type="number" min={0} step={0.1} value={draftTrimStart} onChange={(event) => setDraftTrimStart(event.target.value)} />
                      </label>
                      <label>
                        <span className="field-label">Trim end seconds</span>
                        <input className="field" type="number" min={0} step={0.1} value={draftTrimEnd} onChange={(event) => setDraftTrimEnd(event.target.value)} />
                      </label>
                      <div className="player-calibration__header-actions">
                        <button type="button" className="primary-button player-calibration__small-button" onClick={saveMetadata} disabled={!canSaveMetadata}>
                          {metadataMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" className="ghost-button player-calibration__small-button" onClick={toggleMetadataEditor}>
                          Cancel
                        </button>
                      </div>
                      {metadataMutation.isError ? (
                        <div className="error-state">
                          {metadataMutation.error instanceof Error ? metadataMutation.error.message : 'Failed to save song details.'}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div> : null}
                {!IS_PRACTICE_MODE ? <div className="player-calibration">
                  <button
                    type="button"
                    className="secondary-button player-calibration__toggle"
                    onClick={toggleTimingShiftTool}
                    aria-expanded={isTimingShiftOpen}
                    aria-controls="song-timing-shift-tool"
                  >
                    Timing shift
                  </button>
                  {isTimingShiftOpen ? (
                    <div id="song-timing-shift-tool" className="player-calibration__panel">
                      <div className="player-calibration__value">Shift lyrics from line</div>
                      <div className="muted">
                        Active: {activeBaseLine ? `${activeBaseLine.id} ${formatSeconds(activeBaseLine.start)}-${formatSeconds(activeBaseLine.end)}` : 'none'}
                      </div>
                      <label>
                        <span className="field-label">From line id</span>
                        <input className="field" value={draftShiftFromLineId} onChange={(event) => setDraftShiftFromLineId(event.target.value)} placeholder="l45" />
                      </label>
                      <label>
                        <span className="field-label">Offset seconds</span>
                        <input className="field" type="number" step={0.1} value={draftShiftOffset} onChange={(event) => setDraftShiftOffset(event.target.value)} placeholder="12.5" />
                      </label>
                      {shiftPreview ? (
                        <div className="muted">
                          Preview: {shiftPreview.linesShifted} lines, {shiftPreview.firstLineId} {formatSeconds(shiftPreview.firstStart)} → {formatSeconds(shiftPreview.firstAfterStart)}, {shiftPreview.lastLineId} ends at {formatSeconds(shiftPreview.lastAfterEnd)}.
                        </div>
                      ) : null}
                      {shiftPreview?.hasNegativeTime ? <div className="error-state">This shift would create a negative timestamp.</div> : null}
                      <div className="player-calibration__header-actions">
                        <button type="button" className="primary-button player-calibration__small-button" onClick={applyTimingShift} disabled={!canApplyTimingShift}>
                          {timingShiftMutation.isPending ? 'Applying...' : 'Apply'}
                        </button>
                        <button type="button" className="ghost-button player-calibration__small-button" onClick={toggleTimingShiftTool}>
                          Cancel
                        </button>
                      </div>
                      {timingOffset !== 0 ? <div className="muted">Calibration offset {formatSignedSeconds(timingOffset)} still applies during playback.</div> : null}
                      {timingShiftMutation.isError ? (
                        <div className="error-state">
                          {timingShiftMutation.error instanceof Error ? timingShiftMutation.error.message : 'Failed to shift timing.'}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div> : null}
                <div className="player-calibration">
                  <button
                    type="button"
                    className="secondary-button player-calibration__toggle"
                    onClick={toggleCompactCalibrationSettings}
                    aria-expanded={isCompactCalibrationOpen}
                    aria-controls="compact-sync-offset-controls"
                  >
                    Calibration settings
                  </button>
                  {isCompactCalibrationOpen ? (
                    <div id="compact-sync-offset-controls" className="player-calibration__panel">
                      <div className="player-calibration__header">
                        <div className="player-calibration__value">Offset {formatSignedSeconds(draftTimingOffset)}</div>
                        <div className="player-calibration__header-actions">
                          <button type="button" className="primary-button player-calibration__small-button" onClick={applyCalibrationSettings} disabled={lyricOffsetMutation.isPending}>
                            {lyricOffsetMutation.isPending ? 'Saving...' : 'Apply'}
                          </button>
                          <button type="button" className="ghost-button player-calibration__small-button" onClick={() => applyDraftOffset(0)} disabled={draftTimingOffset === 0}>
                            Reset
                          </button>
                        </div>
                      </div>
                      <div className="player-calibration__actions player-calibration__actions--nudge">
                        <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(-1)}>-1s</button>
                        <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(-0.5)}>-0.5s</button>
                        <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(0.5)}>+0.5s</button>
                        <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(1)}>+1s</button>
                      </div>
                      {lyricOffsetMutation.isError ? (
                        <div className="error-state">
                          {lyricOffsetMutation.error instanceof Error ? lyricOffsetMutation.error.message : 'Failed to save lyric offset.'}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={playbackDuration}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
          />
        </section>

        <LyricsPanel
          lyrics={adjustedLyrics}
          chantEvents={adjustedChantEvents}
          activeLineId={activeLine?.id}
          activeChantEventId={activeChantEvent?.id}
          selectedEditLineId={selectedEditLineId}
          showTranslation={showTranslation}
          hasTranslation={hasTranslation}
          showChantRomanization={showChantRomanization}
          autoScroll={autoScroll}
          isEditing={isEditingLyrics}
          onToggleTranslation={() => setShowTranslation((value) => !value)}
          onToggleChantRomanization={() => setShowChantRomanization((value) => !value)}
          onToggleAutoScroll={() => setAutoScroll((value) => !value)}
          onToggleEditing={IS_PRACTICE_MODE ? undefined : toggleLyricsEditing}
          onSeekToLine={handleSeekToLine}
          onSeekToChantEvent={handleSeekToChantEvent}
          onSelectEditLine={handleSelectEditLine}
          onUpdateChantText={handleUpdateChantText}
          onDeleteChantNote={handleDeleteChantNote}
          onAddChantNote={handleAddChantNote}
          onSaveChantEvents={handleSaveChantEvents}
        />
      </div>
    </PageShell>
  )
}

function findActiveLine(lines: SongLyricLine[], currentTime: number) {
  return lines.find((line) => currentTime >= line.start && currentTime <= line.end)
}

function findActiveChantEvent(events: SongChantEvent[], currentTime: number) {
  return events.find((event) => currentTime >= event.start && currentTime <= event.end)
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

function shiftChantEvents(events: SongChantEvent[], offset: number, clampStart = true): SongChantEvent[] {
  if (offset === 0) {
    return events
  }

  return events.map((event) => {
    const start = clampStart ? Math.max(0, event.start + offset) : event.start + offset
    const end = Math.max(start + 0.1, event.end + offset)

    return { ...event, start, end }
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

function isValidTrimDraft(value: string) {
  const seconds = Number(value)
  return value.trim() !== '' && Number.isFinite(seconds) && seconds >= 0
}

function parseTrimDraft(value: string) {
  return Math.round(Number(value) * 10) / 10
}

function parseShiftOffset(value: string) {
  if (value.trim() === '') {
    return null
  }

  const seconds = Number(value)
  if (!Number.isFinite(seconds)) {
    return null
  }

  return Math.round(seconds * 1000) / 1000
}

function buildShiftPreview(lines: SongLyricLine[], fromLineId: string, offset: number) {
  const startIndex = lines.findIndex((line) => line.id === fromLineId)
  if (startIndex < 0) {
    return null
  }

  const shiftedLines = lines.slice(startIndex)
  const firstLine = shiftedLines[0]
  const lastLine = shiftedLines[shiftedLines.length - 1]

  return {
    linesShifted: shiftedLines.length,
    firstLineId: firstLine.id,
    firstStart: firstLine.start,
    firstAfterStart: roundTime(firstLine.start + offset),
    lastLineId: lastLine.id,
    lastAfterEnd: roundTime(lastLine.end + offset),
    hasNegativeTime: shiftedLines.some((line) => line.start + offset < 0 || line.end + offset < 0),
  }
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`
}

function formatSignedSeconds(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}s`
}
