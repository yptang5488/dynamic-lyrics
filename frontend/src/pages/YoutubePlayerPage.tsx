import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { LyricsPanel } from '../components/LyricsPanel'
import { PageShell } from '../components/PageShell'
import { getSong, getSource, shiftSongTiming, updateSongChantEvents, updateSongLyricNotes, updateSongLyricOffset, updateSongMetadata } from '../lib/api'
import { IS_PRACTICE_MODE } from '../lib/practiceMode'
import { formatTime, normalizeTrimSeconds } from '../lib/time'
import type { SongChantEvent, SongLyricLine } from '../types/api'

declare global {
  interface Window {
    YT?: YoutubeIframeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YoutubeIframeApi {
  Player: new (element: HTMLElement, options: YoutubePlayerOptions) => YoutubePlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}

interface YoutubePlayerOptions {
  videoId: string
  playerVars: Record<string, string | number>
  events: {
    onReady: (event: { target: YoutubePlayer }) => void
    onStateChange: (event: { data: number }) => void
  }
}

interface YoutubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  destroy: () => void
}

let youtubeApiPromise: Promise<YoutubeIframeApi> | null = null
const EMPTY_LYRICS: SongLyricLine[] = []
const EMPTY_CHANT_EVENTS: SongChantEvent[] = []

export function YoutubePlayerPage() {
  const { songId = '' } = useParams()
  const queryClient = useQueryClient()
  const playerHostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YoutubePlayer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [readyVideoId, setReadyVideoId] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [timingOffset, setTimingOffset] = useState(0)
  const [draftTimingOffset, setDraftTimingOffset] = useState(0)
  const [isCompactCalibrationOpen, setIsCompactCalibrationOpen] = useState(false)
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false)
  const [isTimingShiftOpen, setIsTimingShiftOpen] = useState(false)
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [selectedEditLineId, setSelectedEditLineId] = useState<string | null>(null)
  const [draftShiftFromLineId, setDraftShiftFromLineId] = useState('')
  const [draftShiftOffset, setDraftShiftOffset] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftArtist, setDraftArtist] = useState('')
  const [draftYoutubeStart, setDraftYoutubeStart] = useState('0')
  const [draftTrimEnd, setDraftTrimEnd] = useState('0')
  const [editedLineNotes, setEditedLineNotes] = useState<Record<string, Array<Record<string, unknown>>>>({})
  const [editedChantEvents, setEditedChantEvents] = useState<SongChantEvent[] | null>(null)
  const [syncedOffsetKey, setSyncedOffsetKey] = useState('')
  const [showTranslation, setShowTranslation] = useState(true)
  const [showChantRomanization, setShowChantRomanization] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const songQuery = useQuery({
    queryKey: ['song', songId],
    queryFn: () => getSong(songId),
    enabled: Boolean(songId),
  })
  const sourceId = songQuery.data?.audio.sourceId
  const sourceQuery = useQuery({
    queryKey: ['source', sourceId],
    queryFn: () => getSource(sourceId!),
    enabled: Boolean(sourceId),
  })
  const videoId = getYoutubeVideoId(sourceQuery.data?.sourceUrl)
  const isCurrentVideoReady = isReady && readyVideoId === videoId
  const displayCurrentTime = isCurrentVideoReady ? currentTime : 0
  const youtubeStartTime = normalizeTrimSeconds(songQuery.data?.audio.trimStart)
  const baseLyrics = songQuery.data?.lyrics ?? EMPTY_LYRICS
  const baseChantEvents = editedChantEvents ?? songQuery.data?.chantEvents ?? EMPTY_CHANT_EVENTS
  const timelineOffset = youtubeStartTime + timingOffset
  const lyrics = useMemo(() => applyEditedLineNotes(baseLyrics, editedLineNotes), [baseLyrics, editedLineNotes])
  const adjustedLyrics = useMemo(() => shiftLyrics(lyrics, timelineOffset), [lyrics, timelineOffset])
  const adjustedChantEvents = useMemo(() => shiftChantEvents(baseChantEvents, timelineOffset), [baseChantEvents, timelineOffset])
  const activeLine = useMemo(() => findActiveLine(adjustedLyrics, displayCurrentTime), [adjustedLyrics, displayCurrentTime])
  const activeChantEvent = useMemo(() => activeLine ? undefined : findActiveChantEvent(adjustedChantEvents, displayCurrentTime), [activeLine, adjustedChantEvents, displayCurrentTime])
  const hasTranslation = lyrics.some((line) => Boolean(line.translation?.trim()))
  const lyricOffsetMutation = useMutation({
    mutationFn: (lyricOffset: number) => updateSongLyricOffset(songId, lyricOffset),
    onSuccess: (song) => {
      queryClient.setQueryData(['song', song.id], song)
      setSyncedOffsetKey(buildOffsetKey(song.id, song.lyricOffset))
    },
  })
  const lyricNotesMutation = useMutation({
    mutationFn: ({ lineId, notes }: { lineId: string; notes: Array<Record<string, unknown>> }) => updateSongLyricNotes(songId, [{ lineId, notes }]),
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
      setDraftYoutubeStart(String(normalizeTrimSeconds(song.audio.trimStart)))
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

  const savedTimingOffset = roundOffset(songQuery.data?.lyricOffset ?? 0)
  const loadedOffsetKey = songQuery.data?.id === songId ? buildOffsetKey(songQuery.data.id, savedTimingOffset) : ''

  if (loadedOffsetKey && loadedOffsetKey !== syncedOffsetKey && !isCompactCalibrationOpen) {
    setSyncedOffsetKey(loadedOffsetKey)
    setTimingOffset(savedTimingOffset)
    setDraftTimingOffset(savedTimingOffset)
  }

  useEffect(() => {
    const host = playerHostRef.current
    if (!host || !videoId) {
      return
    }

    let disposed = false
    loadYoutubeApi().then((YT) => {
      if (disposed || !playerHostRef.current) {
        return
      }

      playerRef.current?.destroy()
      playerRef.current = new YT.Player(playerHostRef.current, {
        videoId,
        playerVars: { controls: 1, origin: window.location.origin, playsinline: 1 },
        events: {
          onReady: ({ target }) => {
            const videoTime = target.getCurrentTime()
            setCurrentTime(videoTime)
            setReadyVideoId(videoId)
            setIsReady(true)
          },
          onStateChange: () => undefined,
        },
      })
    })

    return () => {
      disposed = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  useEffect(() => {
    if (!isCurrentVideoReady) {
      return
    }

    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (!player) {
        return
      }

      const videoTime = player.getCurrentTime()
      setCurrentTime(videoTime)
    }, 250)

    return () => window.clearInterval(timer)
  }, [isCurrentVideoReady])

  if (songQuery.isLoading || sourceQuery.isLoading) {
    return <PageShell eyebrow="YouTube Player" title="Loading YouTube player" subtitle="Fetching the song and source metadata." />
  }

  if (songQuery.isError || !songQuery.data) {
    return <PageShell eyebrow="YouTube Player" title="Song unavailable" subtitle="The requested song could not be loaded." aside={<BackLink />} />
  }

  const song = songQuery.data
  const error = sourceQuery.isError
    ? sourceQuery.error instanceof Error ? sourceQuery.error.message : 'Source unavailable.'
    : sourceQuery.data?.type !== 'youtube'
      ? 'This song does not use a YouTube source.'
      : !videoId
        ? 'This YouTube source URL could not be embedded.'
        : ''
  const canSaveMetadata = draftTitle.trim().length > 0
    && draftArtist.trim().length > 0
    && isValidTrimDraft(draftYoutubeStart)
    && isValidTrimDraft(draftTrimEnd)
    && !metadataMutation.isPending
  const activeBaseLine = activeLine ? lyrics.find((line) => line.id === activeLine.id) : undefined
  const shiftOffset = parseShiftOffset(draftShiftOffset)
  const shiftPreview = shiftOffset === null ? null : buildShiftPreview(lyrics, draftShiftFromLineId.trim(), shiftOffset)
  const canApplyTimingShift = Boolean(shiftPreview) && !shiftPreview?.hasNegativeTime && !timingShiftMutation.isPending

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
    setDraftTitle(song.title)
    setDraftArtist(song.artist)
    setDraftYoutubeStart(String(normalizeTrimSeconds(song.audio.trimStart)))
    setDraftTrimEnd(String(normalizeTrimSeconds(song.audio.trimEnd)))
    setIsCompactCalibrationOpen(false)
    setIsTimingShiftOpen(false)
    setIsMetadataEditorOpen((value) => !value)
  }

  function toggleTimingShiftTool() {
    setIsCompactCalibrationOpen(false)
    setIsMetadataEditorOpen(false)
    setDraftShiftFromLineId((value) => value || activeBaseLine?.id || '')
    setIsTimingShiftOpen((value) => !value)
  }

  function saveMetadata() {
    metadataMutation.mutate({
      title: draftTitle.trim(),
      artist: draftArtist.trim(),
      trimStart: parseTrimDraft(draftYoutubeStart),
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
    const nextEvents = shiftChantEvents(events, -timelineOffset, false).sort((left, right) => left.start - right.start)
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

  function handleSeek(lyricTime: number) {
    const player = playerRef.current
    if (!player || !isCurrentVideoReady) {
      return
    }

    player.seekTo(Math.max(0, lyricTime), true)
    setCurrentTime(Math.max(0, lyricTime))
  }

  function handleSeekToLine(line: SongLyricLine) {
    handleSeek(line.start)
    playerRef.current?.playVideo()
  }

  function handleSeekToChantEvent(event: SongChantEvent) {
    handleSeek(event.start)
    playerRef.current?.playVideo()
  }

  function startSong() {
    const player = playerRef.current
    if (!player || !isCurrentVideoReady) {
      return
    }

    player.seekTo(youtubeStartTime, true)
    player.playVideo()
  }

  return (
    <PageShell
      eyebrow="YouTube Player"
      title={song.title}
      subtitle="Use YouTube playback with synced lyrics and click-to-seek navigation."
      aside={<BackLink />}
      hideHeader
    >
      <div className="page-grid">
        <div className="youtube-player-shell">
          <div className="youtube-player-toolbar">
            <Link className="player-hero__back" to="/" aria-label="Back to library">
              <span aria-hidden="true">←</span>
              <span>Back to library</span>
            </Link>
            <div className="player-toolbar-actions">
              {!IS_PRACTICE_MODE ? <div className="player-calibration">
                <button type="button" className="secondary-button player-calibration__toggle" onClick={toggleMetadataEditor} aria-expanded={isMetadataEditorOpen} aria-controls="youtube-song-metadata-editor">
                  Edit details
                </button>
                {isMetadataEditorOpen ? (
                  <div id="youtube-song-metadata-editor" className="player-calibration__panel">
                    <label>
                      <span className="field-label">Song title</span>
                      <input className="field" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                    </label>
                    <label>
                      <span className="field-label">Artist</span>
                      <input className="field" value={draftArtist} onChange={(event) => setDraftArtist(event.target.value)} />
                    </label>
                    <label>
                      <span className="field-label">Start song seconds</span>
                      <input className="field" type="number" min={0} step={0.1} value={draftYoutubeStart} onChange={(event) => setDraftYoutubeStart(event.target.value)} />
                    </label>
                    <label>
                      <span className="field-label">Classic trim end seconds</span>
                      <input className="field" type="number" min={0} step={0.1} value={draftTrimEnd} onChange={(event) => setDraftTrimEnd(event.target.value)} />
                    </label>
                    <div className="player-calibration__header-actions">
                      <button type="button" className="primary-button player-calibration__small-button" onClick={saveMetadata} disabled={!canSaveMetadata}>{metadataMutation.isPending ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="ghost-button player-calibration__small-button" onClick={toggleMetadataEditor}>Cancel</button>
                    </div>
                    {metadataMutation.isError ? <div className="error-state">{metadataMutation.error instanceof Error ? metadataMutation.error.message : 'Failed to save song details.'}</div> : null}
                  </div>
                ) : null}
              </div> : null}
              {!IS_PRACTICE_MODE ? <div className="player-calibration">
                <button type="button" className="secondary-button player-calibration__toggle" onClick={toggleTimingShiftTool} aria-expanded={isTimingShiftOpen} aria-controls="youtube-song-timing-shift-tool">
                  Timing shift
                </button>
                {isTimingShiftOpen ? (
                  <div id="youtube-song-timing-shift-tool" className="player-calibration__panel">
                    <div className="player-calibration__value">Shift lyrics from line</div>
                    <div className="muted">Active: {activeBaseLine ? `${activeBaseLine.id} ${formatSeconds(activeBaseLine.start)}-${formatSeconds(activeBaseLine.end)}` : 'none'}</div>
                    <label>
                      <span className="field-label">From line id</span>
                      <input className="field" value={draftShiftFromLineId} onChange={(event) => setDraftShiftFromLineId(event.target.value)} placeholder="l45" />
                    </label>
                    <label>
                      <span className="field-label">Offset seconds</span>
                      <input className="field" type="number" step={0.1} value={draftShiftOffset} onChange={(event) => setDraftShiftOffset(event.target.value)} placeholder="12.5" />
                    </label>
                    {shiftPreview ? <div className="muted">Preview: {shiftPreview.linesShifted} lines, {shiftPreview.firstLineId} {formatSeconds(shiftPreview.firstStart)} → {formatSeconds(shiftPreview.firstAfterStart)}, {shiftPreview.lastLineId} ends at {formatSeconds(shiftPreview.lastAfterEnd)}.</div> : null}
                    {shiftPreview?.hasNegativeTime ? <div className="error-state">This shift would create a negative timestamp.</div> : null}
                    <div className="player-calibration__header-actions">
                      <button type="button" className="primary-button player-calibration__small-button" onClick={applyTimingShift} disabled={!canApplyTimingShift}>{timingShiftMutation.isPending ? 'Applying...' : 'Apply'}</button>
                      <button type="button" className="ghost-button player-calibration__small-button" onClick={toggleTimingShiftTool}>Cancel</button>
                    </div>
                    {timingOffset !== 0 ? <div className="muted">Calibration offset {formatSignedSeconds(timingOffset)} still applies during playback.</div> : null}
                    {timingShiftMutation.isError ? <div className="error-state">{timingShiftMutation.error instanceof Error ? timingShiftMutation.error.message : 'Failed to shift timing.'}</div> : null}
                  </div>
                ) : null}
              </div> : null}
              {!IS_PRACTICE_MODE ? <div className="player-calibration">
                <button type="button" className="secondary-button player-calibration__toggle" onClick={toggleCompactCalibrationSettings} aria-expanded={isCompactCalibrationOpen} aria-controls="youtube-sync-offset-controls">
                  Calibration settings
                </button>
                {isCompactCalibrationOpen ? (
                  <div id="youtube-sync-offset-controls" className="player-calibration__panel">
                    <div className="player-calibration__header">
                      <div className="player-calibration__value">Offset {formatSignedSeconds(draftTimingOffset)}</div>
                      <div className="player-calibration__header-actions">
                        <button type="button" className="primary-button player-calibration__small-button" onClick={applyCalibrationSettings} disabled={lyricOffsetMutation.isPending}>{lyricOffsetMutation.isPending ? 'Saving...' : 'Apply'}</button>
                        <button type="button" className="ghost-button player-calibration__small-button" onClick={() => applyDraftOffset(0)} disabled={draftTimingOffset === 0}>Reset</button>
                      </div>
                    </div>
                    <div className="player-calibration__actions player-calibration__actions--nudge">
                      <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(-1)}>-1s</button>
                      <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(-0.5)}>-0.5s</button>
                      <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(0.5)}>+0.5s</button>
                      <button type="button" className="ghost-button" onClick={() => handleNudgeTiming(1)}>+1s</button>
                    </div>
                    {lyricOffsetMutation.isError ? <div className="error-state">{lyricOffsetMutation.error instanceof Error ? lyricOffsetMutation.error.message : 'Failed to save lyric offset.'}</div> : null}
                  </div>
                ) : null}
              </div> : null}
            </div>
          </div>
        </div>
        <div className="youtube-player-layout">
          <LyricsPanel
            title={song.title}
            artist={song.artist}
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
          <div className="youtube-player-shell">
            {error ? <div className="error-state">{error}</div> : <div className="youtube-player-frame" ref={playerHostRef} />}
            <button type="button" className="primary-button youtube-player-start-button" onClick={startSong} disabled={!isCurrentVideoReady}>
              <span className="youtube-player-start-icon" aria-hidden="true" />
              Start song ({formatTime(youtubeStartTime)})
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function BackLink() {
  return <Link className="secondary-button" to="/">Back to library</Link>
}

function loadYoutubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }
  if (youtubeApiPromise) {
    return youtubeApiPromise
  }

  youtubeApiPromise = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!)
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return youtubeApiPromise
}

function getYoutubeVideoId(url: string | null | undefined) {
  if (!url) {
    return ''
  }

  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1)
    }
    if (parsed.pathname.startsWith('/embed/')) {
      return parsed.pathname.split('/')[2] ?? ''
    }
    return parsed.searchParams.get('v') ?? ''
  } catch {
    return ''
  }
}

function findActiveLine(lyrics: SongLyricLine[], currentTime: number) {
  return lyrics.find((line) => currentTime >= line.start && currentTime < line.end)
}

function findActiveChantEvent(events: SongChantEvent[], currentTime: number) {
  return events.find((event) => currentTime >= event.start && currentTime < event.end)
}

function shiftLyrics(lines: SongLyricLine[], offset: number) {
  if (offset === 0) {
    return lines
  }

  return lines.map((line) => ({ ...line, start: line.start + offset, end: line.end + offset }))
}

function applyEditedLineNotes(
  lines: SongLyricLine[],
  editedLineNotes: Record<string, Array<Record<string, unknown>>>,
) {
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

function shiftChantEvents(events: SongChantEvent[], offset: number, clampStart = true) {
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
