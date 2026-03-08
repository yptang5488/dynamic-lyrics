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
    </div>
  )
}
