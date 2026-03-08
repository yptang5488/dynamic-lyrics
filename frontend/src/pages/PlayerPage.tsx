import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showTranslation, setShowTranslation] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)

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

  const activeLine = useMemo(() => findActiveLine(songQuery.data?.lyrics ?? [], currentTime), [songQuery.data?.lyrics, currentTime])

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
    if (audio.paused) {
      void audio.play()
    }
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
        aside={<Link className="secondary-button" to="/">Back to import</Link>}
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
      aside={<Link className="secondary-button" to="/">Import another song</Link>}
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
        </section>

        <div className="split-grid">
          <LyricsPanel
            lyrics={song.lyrics}
            activeLineId={activeLine?.id}
            showTranslation={showTranslation}
            autoScroll={autoScroll}
            onSeekToLine={handleSeekToLine}
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
