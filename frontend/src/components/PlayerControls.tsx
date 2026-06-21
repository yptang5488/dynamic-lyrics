import { formatTime } from '../lib/time'
import type { CSSProperties, ReactNode } from 'react'

interface PlayerControlsProps {
  title: string
  artist: string
  actions?: ReactNode
  isPlaying: boolean
  currentTime: number
  duration: number
  onTogglePlay: () => void
  onSeek: (value: number) => void
}

export function PlayerControls({ title, artist, actions, isPlaying, currentTime, duration, onTogglePlay, onSeek }: PlayerControlsProps) {
  const seekProgress = duration > 0 ? `${Math.min(currentTime / duration, 1) * 100}%` : '0%'

  return (
    <div className="player-controls">
      <div className="transport-row">
        <button type="button" className="transport-button" onClick={onTogglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div>
          <div className="player-controls__title">{title}</div>
          <p className="player-controls__artist">{artist}</p>
        </div>
        {actions ? <div className="player-controls__actions">{actions}</div> : null}
      </div>

      <div className="time-row">
        <span>{formatTime(currentTime)}</span>
        <input
          className="seek-input"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          style={{ '--seek-progress': seekProgress } as CSSProperties}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
