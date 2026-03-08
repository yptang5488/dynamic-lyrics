import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { JobStatusCard } from '../components/JobStatusCard'
import { PageShell } from '../components/PageShell'
import { SectionCard } from '../components/SectionCard'
import { createAlignment, getJob, getSource } from '../lib/api'
import { clearWorkflow, loadWorkflow, saveWorkflow } from '../lib/workflow'
import type { JobStatus, JobType, WorkflowState } from '../types/api'

export function JobPage() {
  const { jobId = '' } = useParams()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState<WorkflowState | null>(() => loadWorkflow())
  const [jobError, setJobError] = useState<string | null>(null)
  const [hasStartedAlignment, setHasStartedAlignment] = useState(false)

  const currentJobId = workflow?.alignmentJobId ?? workflow?.sourceJobId ?? jobId

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
    if (!job) {
      return
    }

    if (job.type === 'alignment' && job.status === 'done' && job.result?.songId) {
      if (workflow && workflow.songId !== job.result.songId) {
        const nextWorkflow = { ...workflow, songId: job.result.songId }
        setWorkflow(nextWorkflow)
        saveWorkflow(nextWorkflow)
      }

      const timer = window.setTimeout(() => {
        navigate(`/player/${job.result?.songId}`)
      }, 900)
      return () => window.clearTimeout(timer)
    }

    if (!workflow) {
      if (job.status === 'failed') {
        setJobError(job.errorMessage ?? 'The current job failed.')
      }
      return
    }

    if (job.type === 'youtube_import' && job.status === 'done' && !workflow.alignmentJobId && !hasStartedAlignment) {
      setHasStartedAlignment(true)
      void createAlignment({
        sourceId: workflow.sourceId,
        language: workflow.language,
        lyricsText: workflow.lyricsText,
        translations: workflow.translationsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      })
        .then((alignment) => {
          const nextWorkflow = { ...workflow, alignmentJobId: alignment.jobId }
          setWorkflow(nextWorkflow)
          saveWorkflow(nextWorkflow)
          navigate(`/jobs/${alignment.jobId}`, { replace: true })
        })
        .catch((error: Error) => {
          setJobError(error.message)
          setHasStartedAlignment(false)
        })
    }

    if (job.status === 'failed') {
      setJobError(job.errorMessage ?? 'The current job failed.')
    }
  }, [hasStartedAlignment, jobQuery.data, navigate, workflow])

  const completedSongId = jobQuery.data?.type === 'alignment' ? jobQuery.data.result?.songId : undefined

  const title = useMemo(() => {
    const type = jobQuery.data?.type
    if (type === 'youtube_import') {
      return 'Preparing your audio source'
    }
    if (type === 'alignment') {
      return 'Building synced lyrics'
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
              error={jobError ?? jobQuery.data.errorMessage}
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
              <div className="detail-row">
                <span>Language</span>
                <strong>{workflow?.language.toUpperCase() ?? 'N/A'}</strong>
              </div>
            </div>
            {!workflow ? (
              <div className="error-state" style={{ marginTop: 16 }}>
                Workflow context is missing in session storage. This page can still show job status, but YouTube jobs cannot continue into alignment automatically.
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
                <span className="muted">The app automatically submits the alignment step for YouTube-based workflows.</span>
              </div>
              <div className="metric">
                <strong>Alignment complete</strong>
                <span className="muted">You are redirected to the player with translation toggle and click-to-seek ready.</span>
              </div>
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
  if (type === 'alignment') {
    return 'Creating the timed lyric payload used by the player.'
  }
  return 'Finishing the current job.'
}
