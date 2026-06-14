import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { SectionCard } from '../components/SectionCard'
import { createLrcImport, getJob, getSource, searchSyncedLrc } from '../lib/api'
import { loadWorkflow, saveWorkflow } from '../lib/workflow'

export function YoutubeLrcPreviewPage() {
  const { jobId = '' } = useParams()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState(() => loadWorkflow())
  const [query, setQuery] = useState('')
  const [providerText, setProviderText] = useState('')
  const [lrcText, setLrcText] = useState('')
  const [lrcSourceLabel, setLrcSourceLabel] = useState('Not fetched yet')
  const [warnings, setWarnings] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const jobQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    enabled: Boolean(jobId),
  })

  const result = jobQuery.data?.result
  const sourceId = typeof result?.sourceId === 'string' ? result.sourceId : workflow?.sourceId

  const sourceQuery = useQuery({
    queryKey: ['source', sourceId],
    queryFn: () => getSource(sourceId!),
    enabled: Boolean(sourceId),
  })

  useEffect(() => {
    if (!query && sourceQuery.data?.title && !sourceQuery.data.title.startsWith('src_')) {
      setQuery(sourceQuery.data.title)
    }
  }, [query, sourceQuery.data?.title])

  async function handleSearch() {
    setError(null)
    setWarnings([])
    if (!query.trim()) {
      setError('Enter a song title and artist before fetching LRC.')
      return
    }

    setIsSearching(true)
    try {
      const providers = providerText
        .split(',')
        .map((provider) => provider.trim())
        .filter(Boolean)
      const payload = await searchSyncedLrc({
        query: query.trim(),
        providers: providers.length ? providers : undefined,
      })
      setLrcText(payload.lrcText)
      setWarnings(payload.warnings)
      setLrcSourceLabel(`Fetched: ${query.trim()}`)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Failed to fetch synced LRC.')
    } finally {
      setIsSearching(false)
    }
  }

  async function handleCreatePlayer() {
    setError(null)
    if (!sourceId) {
      setError('Missing source id for this YouTube import.')
      return
    }
    if (!lrcText.trim()) {
      setError('Fetch, upload, or paste LRC text before creating the player.')
      return
    }

    setIsSubmitting(true)
    try {
      const lrcImport = await createLrcImport({ sourceId, lrcText })
      const nextWorkflow = {
        sourceId,
        sourceMode: 'youtube' as const,
        sourceJobId: jobId,
        lrcJobId: lrcImport.jobId,
      }
      setWorkflow(nextWorkflow)
      saveWorkflow(nextWorkflow)
      navigate(`/jobs/${lrcImport.jobId}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create LRC import job.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLrcUpload(file: File | undefined) {
    if (!file) {
      return
    }
    setError(null)
    setWarnings([])
    setLrcText(await file.text())
    setLrcSourceLabel(`Uploaded: ${file.name}`)
  }

  if (jobQuery.isLoading) {
    return (
      <PageShell
        eyebrow="YouTube LRC"
        title="Loading source"
        subtitle="Fetching the YouTube import result before searching for synced lyrics."
      />
    )
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <PageShell
        eyebrow="YouTube LRC"
        title="Preview unavailable"
        subtitle="The YouTube import job could not be loaded."
        aside={<Link className="secondary-button" to="/import">New import</Link>}
      >
        <div className="error-state">{jobQuery.error instanceof Error ? jobQuery.error.message : 'Job not found.'}</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow="YouTube LRC Search"
      title="Fetch synced lyrics for this audio"
      subtitle="The YouTube URL controls the audio version. Use syncedlyrics to fetch a candidate LRC, then review it before creating the player."
      aside={<Link className="secondary-button" to="/import">New import</Link>}
    >
      <div className="split-grid">
        <SectionCard title="Find LRC" subtitle="Search by title and artist. Leave providers empty to let syncedlyrics try all defaults.">
          <div className="form-grid">
            <div>
              <label className="field-label" htmlFor="lrc-query">Song query</label>
              <input
                id="lrc-query"
                className="field"
                type="text"
                placeholder="MAMAMOO 4 flowers"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="lrc-providers">Providers</label>
              <input
                id="lrc-providers"
                className="field"
                type="text"
                placeholder="Lrclib, NetEase"
                value={providerText}
                onChange={(event) => setProviderText(event.target.value)}
              />
              <p className="field-help">Comma-separated. Leave empty to let syncedlyrics use its defaults.</p>
            </div>
          </div>

          <div className="actions" style={{ marginTop: 18 }}>
            <button className="primary-button" type="button" disabled={isSearching} onClick={handleSearch}>
              {isSearching ? 'Fetching LRC...' : 'Fetch synced LRC'}
            </button>
          </div>

          <div className="quick-list" style={{ marginTop: 18 }}>
            <div className="detail-row">
              <span>Current LRC</span>
              <strong>{lrcText.trim() ? lrcSourceLabel : 'No LRC loaded'}</strong>
            </div>
            <div className="file-shell">
              <input
                className="file-input"
                type="file"
                accept=".lrc,text/plain"
                onChange={(event) => void handleLrcUpload(event.target.files?.[0])}
              />
              <span className="field-help">Upload a replacement `.lrc` if search returns the wrong language or version.</span>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="field-label" htmlFor="lrc-editor">LRC text preview</label>
            <textarea
              id="lrc-editor"
              className="textarea"
              style={{ minHeight: 360 }}
              value={lrcText}
              onChange={(event) => setLrcText(event.target.value)}
              placeholder="Fetch, upload, or paste LRC text here."
            />
          </div>

          {warnings.length ? (
            <div className="warning-list" style={{ marginTop: 16 }}>
              {warnings.map((warning) => <div key={warning}>{warning}</div>)}
            </div>
          ) : null}
          {error ? <div className="error-state" style={{ marginTop: 16 }}>{error}</div> : null}

          <div className="actions" style={{ marginTop: 20 }}>
            <button className="primary-button" type="button" disabled={isSubmitting} onClick={handleCreatePlayer}>
              {isSubmitting ? 'Creating player...' : 'Use this LRC and create player'}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Audio source" subtitle="This is the YouTube audio that the LRC will be paired with.">
          <div className="detail-list">
            <div className="detail-row">
              <span>Source id</span>
              <span className="inline-code">{sourceId ?? 'missing'}</span>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <span className={`badge badge--${sourceQuery.data?.status ?? 'queued'}`}>{sourceQuery.data?.status ?? 'loading'}</span>
            </div>
            <div className="detail-row">
              <span>Title</span>
              <strong>{sourceQuery.data?.title ?? 'Unknown'}</strong>
            </div>
            <div className="metric">
              <strong>Still verify timing</strong>
              <span className="muted">The audio is now explicit, but LRC providers can still return a different edit or offset.</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  )
}
