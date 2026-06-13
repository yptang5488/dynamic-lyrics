import type { SourceMode } from '../types/api'

interface SourceModeSwitchProps {
  value: SourceMode
  onChange: (mode: SourceMode) => void
}

export function SourceModeSwitch({ value, onChange }: SourceModeSwitchProps) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Source mode">
      <button
        type="button"
        className={value === 'upload' ? 'is-active' : ''}
        onClick={() => onChange('upload')}
      >
        <strong>Upload audio</strong>
        Use a local file you already own.
      </button>
      <button
        type="button"
        className={value === 'youtube' ? 'is-active' : ''}
        onClick={() => onChange('youtube')}
      >
        <strong>YouTube import</strong>
        Paste a single watch URL for personal testing.
      </button>
      <button
        type="button"
        className={value === 'spotify' ? 'is-active' : ''}
        onClick={() => onChange('spotify')}
      >
        <strong>Spotify import</strong>
        Search or paste a Spotify link, then let spotdl fetch audio and LRC.
      </button>
    </div>
  )
}
