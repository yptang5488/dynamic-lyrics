import { useEffect, useMemo, useRef } from 'react'
import { formatTime } from '../lib/time'
import type { SongLyricLine } from '../types/api'

interface LyricsPanelProps {
  lyrics: SongLyricLine[]
  activeLineId?: string
  showTranslation: boolean
  autoScroll: boolean
  onSeekToLine: (line: SongLyricLine) => void
}

export function LyricsPanel({ lyrics, activeLineId, showTranslation, autoScroll, onSeekToLine }: LyricsPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const activeIndex = useMemo(() => lyrics.findIndex((item) => item.id === activeLineId), [lyrics, activeLineId])

  useEffect(() => {
    if (!autoScroll || !listRef.current || !activeRef.current) {
      return
    }

    const list = listRef.current
    const activeLine = activeRef.current
    const nextTop = activeLine.offsetTop - list.clientHeight / 2 + activeLine.clientHeight / 2

    list.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [activeLineId, autoScroll])

  return (
    <section className="lyrics-card">
      <div className="player-topline">
        <div>
          <h2>Lyrics flow</h2>
          <p className="section-subtitle">Current, previous, and upcoming lines stay readable during playback.</p>
        </div>
      </div>

      <div ref={listRef} className="lyrics-list">
        {lyrics.map((line, index) => {
          const isActive = line.id === activeLineId
          const isPast = activeIndex >= 0 && index < activeIndex

          return (
            <button
              key={line.id}
              ref={isActive ? activeRef : null}
              type="button"
              className={`lyric-line${isActive ? ' lyric-line--active' : ''}${isPast ? ' lyric-line--past' : ''}`}
              onClick={() => onSeekToLine(line)}
            >
              <span className="lyric-line__time">{formatTime(line.start)} - {formatTime(line.end)}</span>
              <span className="lyric-line__text">{line.text}</span>
              {showTranslation && line.translation ? (
                <span className="lyric-line__translation">{line.translation}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
