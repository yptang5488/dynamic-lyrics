import { formatTime } from '../lib/time'

interface PlayerControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  onTogglePlay: () => void
  onSeek: (value: number) => void
}

export function PlayerControls({ isPlaying, currentTime, duration, onTogglePlay, onSeek }: PlayerControlsProps) {
  return (
    <div className="player-controls">
      <div className="transport-row">
        <button type="button" className="transport-button" onClick={onTogglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div>
          <div className="eyebrow">Realtime lyric sync</div>
          <p className="muted">Tap any lyric line to replay that moment instantly.</p>
        </div>
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
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
