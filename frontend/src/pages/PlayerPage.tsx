import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { LyricsPanel } from '../components/LyricsPanel'
import { PageShell } from '../components/PageShell'
import { PlayerControls } from '../components/PlayerControls'
import { getSong, resolveMediaUrl, updateSongLyricNotes, updateSongLyricOffset, updateSongMetadata } from '../lib/api'
import type { SongLyricLine } from '../types/api'

const EMPTY_LYRICS: SongLyricLine[] = []
const OFFSET_RANGE_SECONDS = 10

export function PlayerPage() {
  const { songId = '' } = useParams()
  const queryClient = useQueryClient()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showTranslation, setShowTranslation] = useState(true)
  const [showChantRomanization, setShowChantRomanization] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [selectedEditLineId, setSelectedEditLineId] = useState<string | null>(null)
  const [timingOffset, setTimingOffset] = useState(0)
  const [draftTimingOffset, setDraftTimingOffset] = useState(0)
  const [isCompactCalibrationOpen, setIsCompactCalibrationOpen] = useState(false)
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftArtist, setDraftArtist] = useState('')
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
  const metadataMutation = useMutation({
    mutationFn: ({ title, artist }: { title: string; artist: string }) => updateSongMetadata(songId, title, artist),
    onSuccess: (song) => {
      queryClient.setQueryData(['song', song.id], song)
      setDraftTitle(song.title)
      setDraftArtist(song.artist)
      setIsMetadataEditorOpen(false)
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
    setIsCompactCalibrationOpen(false)
    setIsMetadataEditorOpen(false)
    setDraftTitle('')
    setDraftArtist('')
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
  const originalLyrics = useMemo(() => applyEditedLineNotes(baseLyrics, editedLineNotes), [baseLyrics, editedLineNotes])
  const adjustedLyrics = useMemo(() => shiftLyrics(originalLyrics, timingOffset), [originalLyrics, timingOffset])
  const activeLine = useMemo(() => findActiveLine(adjustedLyrics, currentTime), [adjustedLyrics, currentTime])
  const offsetRangeStart = -OFFSET_RANGE_SECONDS
  const offsetRangeEnd = OFFSET_RANGE_SECONDS

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

  function toggleLyricsEditing() {
    setIsEditingLyrics((value) => !value)
    setSelectedEditLineId(null)
  }

  function toggleCompactCalibrationSettings() {
    setDraftTimingOffset(timingOffset)
    setIsMetadataEditorOpen(false)
    setIsCompactCalibrationOpen((value) => !value)
  }

  function toggleMetadataEditor() {
    const song = songQuery.data
    if (!song) {
      return
    }

    setDraftTitle(song.title)
    setDraftArtist(song.artist)
    setIsCompactCalibrationOpen(false)
    setIsMetadataEditorOpen((value) => !value)
  }

  function saveMetadata() {
    metadataMutation.mutate({ title: draftTitle.trim(), artist: draftArtist.trim() })
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
  const canSaveMetadata = draftTitle.trim().length > 0 && draftArtist.trim().length > 0 && !metadataMutation.isPending

  return (
    <PageShell
      eyebrow="Learning Player"
      title={song.title}
      subtitle="Use line-level sync to rehearse the song, reveal or hide translations, and jump directly from the lyric list."
      hideHeader
    >
      <div className="page-grid">
        <section className={`player-hero${isCompactCalibrationOpen || isMetadataEditorOpen ? ' player-hero--popover-open' : ''}`} aria-label="Playback controls">
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
                <div className="player-calibration">
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
                </div>
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
            duration={duration || song.audio.duration || 0}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
          />
        </section>

        <LyricsPanel
          lyrics={adjustedLyrics}
          activeLineId={activeLine?.id}
          selectedEditLineId={selectedEditLineId}
          showTranslation={showTranslation}
          showChantRomanization={showChantRomanization}
          autoScroll={autoScroll}
          isEditing={isEditingLyrics}
          onToggleTranslation={() => setShowTranslation((value) => !value)}
          onToggleChantRomanization={() => setShowChantRomanization((value) => !value)}
          onToggleAutoScroll={() => setAutoScroll((value) => !value)}
          onToggleEditing={toggleLyricsEditing}
          onSeekToLine={handleSeekToLine}
          onSelectEditLine={handleSelectEditLine}
          onUpdateChantText={handleUpdateChantText}
          onDeleteChantNote={handleDeleteChantNote}
          onAddChantNote={handleAddChantNote}
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
