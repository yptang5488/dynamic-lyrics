import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { JobStatusCard } from '../components/JobStatusCard'
import { PageShell } from '../components/PageShell'
import { SectionCard } from '../components/SectionCard'
import { getJob, getSource } from '../lib/api'
import { clearWorkflow, loadWorkflow, saveWorkflow } from '../lib/workflow'
import type { JobStatus, JobType, WorkflowState } from '../types/api'

export function JobPage() {
  const { jobId = '' } = useParams()
  const navigate = useNavigate()
  const [workflow] = useState<WorkflowState | null>(() => loadWorkflow())

  const currentJobId = workflow?.lrcJobId ?? workflow?.sourceJobId ?? jobId

  const jobQuery = useQuery({
    queryKey: ['job', currentJobId],
    queryFn: () => getJob(currentJobId),
    enabled: Boolean(currentJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'done' || status === 'failed' ? false : 1500
    },
  })

  const sourceQuery = useQuery({
    queryKey: ['source', workflow?.sourceId],
    queryFn: () => getSource(workflow!.sourceId),
    enabled: Boolean(workflow?.sourceId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'ready' || status === 'failed' ? false : 1800
    },
  })

  useEffect(() => {
    const job = jobQuery.data
    const songId = extractSongId(job?.result)
    if (!job) {
      return
    }

    if ((job.type === 'lrc_import' || job.type === 'spotify_import') && job.status === 'done' && songId) {
      if (workflow && workflow.songId !== songId) {
        saveWorkflow({ ...workflow, songId })
      }

      const timer = window.setTimeout(() => {
        navigate(`/player/${songId}`)
      }, 900)
      return () => window.clearTimeout(timer)
    }

    if (job.type === 'spotify_import' && job.status === 'done') {
      navigate(`/spotify-preview/${job.id}`, { replace: true })
      return
    }

    if (job.type === 'youtube_import' && job.status === 'done') {
      navigate(`/youtube-lrc/${job.id}`, { replace: true })
      return
    }

  }, [jobQuery.data, navigate, workflow])

  const completedSongId = jobQuery.data?.type === 'lrc_import' || jobQuery.data?.type === 'spotify_import'
    ? extractSongId(jobQuery.data.result)
    : undefined
  const displayedError = jobQuery.data?.errorMessage ?? (jobQuery.data?.status === 'failed' ? 'The current job failed.' : null)
  const jobWarnings = extractWarnings(jobQuery.data?.result)

  const title = useMemo(() => {
    const type = jobQuery.data?.type
    if (type === 'youtube_import') {
      return 'Preparing your audio source'
    }
    if (type === 'spotify_import') {
      return 'Importing Spotify source with spotdl'
    }
    if (type === 'lrc_import') {
      return 'Importing paired LRC timing'
    }
    return 'Checking workflow state'
  }, [jobQuery.data?.type])

  return (
    <PageShell
      eyebrow="Job Monitor"
      title="Your learning session is being prepared"
      subtitle="This page follows the backend workflow from audio import to line-level timing so you can move into the player without manual steps."
      aside={
        <button type="button" className="secondary-button" onClick={() => navigate('/')}>
          New import
        </button>
      }
    >
      <div className="split-grid">
        <div className="page-grid">
          {jobQuery.isLoading ? (
            <div className="status-card">Loading the latest job state...</div>
          ) : jobQuery.data ? (
            <JobStatusCard
              title={title}
              type={jobQuery.data.type}
              status={jobQuery.data.status}
              progress={jobQuery.data.progress}
              message={jobQuery.data.message ?? inferMessage(jobQuery.data.type, jobQuery.data.status)}
              error={displayedError}
              warnings={jobWarnings}
            />
          ) : (
            <div className="error-state">Job details could not be loaded.</div>
          )}

          <SectionCard title="Current workflow" subtitle="What the app is doing right now.">
            <div className="detail-list">
              <div className="detail-row">
                <span>Source mode</span>
                <strong>{workflow?.sourceMode ?? 'Unknown'}</strong>
              </div>
              <div className="detail-row">
                <span>Current job id</span>
                <span className="inline-code">{currentJobId}</span>
              </div>
              <div className="detail-row">
                <span>Source id</span>
                <span className="inline-code">{workflow?.sourceId ?? 'Not set'}</span>
              </div>
            </div>
            {!workflow ? (
              <div className="error-state" style={{ marginTop: 16 }}>
                Workflow context is missing in session storage. This page can still show job status, but source-specific follow-up steps may be unavailable.
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="page-grid">
          <SectionCard title="Source status" subtitle="Useful when the import step needs more time or fails.">
            {sourceQuery.data ? (
              <div className="detail-list">
                <div className="detail-row">
                  <span>Status</span>
                  <span className={`badge badge--${sourceQuery.data.status}`}>{sourceQuery.data.status}</span>
                </div>
                <div className="detail-row">
                  <span>Title</span>
                  <strong>{sourceQuery.data.title ?? 'Pending metadata'}</strong>
                </div>
                <div className="detail-row">
                  <span>Duration</span>
                  <strong>{sourceQuery.data.duration ? `${Math.round(sourceQuery.data.duration)} sec` : 'Pending'}</strong>
                </div>
                {sourceQuery.data.errorMessage ? (
                  <div className="error-state">{sourceQuery.data.errorMessage}</div>
                ) : null}
              </div>
            ) : (
              <p className="muted">Source metadata appears here when a source has been created.</p>
            )}
          </SectionCard>

          <SectionCard title="What happens next" subtitle="Expected behavior after each step completes.">
            <div className="quick-list">
              <div className="metric">
                <strong>Import complete</strong>
                <span className="muted">LRC import jobs create the player directly. YouTube sources continue to synced LRC search before player creation.</span>
              </div>
              <div className="metric">
                <strong>Song payload complete</strong>
                <span className="muted">You are redirected to the player with translation toggle and click-to-seek ready.</span>
              </div>
              {jobWarnings.length ? (
                <div className="metric">
                  <strong>Warnings captured</strong>
                  <span className="muted">Review the import warnings before trusting every line timing without a quick check.</span>
                </div>
              ) : null}
              {completedSongId ? (
                <button type="button" className="primary-button" onClick={() => navigate(`/player/${completedSongId}`)}>
                  Open player now
                </button>
              ) : null}
              <button type="button" className="ghost-button" onClick={() => { clearWorkflow(); navigate('/') }}>
                Reset current workflow
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  )
}

function inferMessage(type: JobType, status: JobStatus) {
  if (status === 'queued') {
    return 'Waiting for a local worker thread to pick up this job.'
  }
  if (type === 'youtube_import') {
    return 'Downloading audio and preparing a reusable local source.'
  }
  if (type === 'spotify_import') {
    return 'Downloading with spotdl, importing synced LRC, and preparing the player payload.'
  }
  if (type === 'lrc_import') {
    return 'Parsing paired bilingual LRC timing and exporting the player payload.'
  }
  return 'Finishing the current job.'
}

function extractWarnings(result: Record<string, unknown> | null | undefined) {
  const warnings = result?.warnings
  if (!Array.isArray(warnings)) {
    return []
  }

  return warnings.filter((warning): warning is string => typeof warning === 'string' && warning.length > 0)
}

function extractSongId(result: Record<string, unknown> | null | undefined) {
  return typeof result?.songId === 'string' && result.songId.length > 0 ? result.songId : undefined
}
