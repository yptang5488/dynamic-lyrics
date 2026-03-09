import type { JobStatus, JobType } from '../types/api'

interface JobStatusCardProps {
  title: string
  type: JobType
  status: JobStatus
  progress: number
  message?: string | null
  error?: string | null
  warnings?: string[]
}

export function JobStatusCard({ title, type, status, progress, message, error, warnings = [] }: JobStatusCardProps) {
  return (
    <section className="status-card">
      <div className="status-row">
        <div>
          <h2>{title}</h2>
          <p className="section-subtitle">
            {type === 'youtube_import' ? 'Import audio source' : 'Build timed lyrics'}
          </p>
        </div>
        <span className={`badge badge--${status}`}>{status}</span>
      </div>

      <div className="status-list">
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="status-row">
          <span>{message ?? 'Waiting for the current step to report progress.'}</span>
          <strong>{progress}%</strong>
        </div>
        {error ? <div className="error-state">{error}</div> : null}
        {warnings.length ? (
          <div className="detail-list">
            <div className="detail-row">
              <span>Import warnings</span>
              <strong>{warnings.length}</strong>
            </div>
            {warnings.map((warning) => (
              <div key={warning} className="muted">
                {warning}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
