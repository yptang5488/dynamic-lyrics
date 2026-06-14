import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { SectionCard } from '../components/SectionCard'
import { SourceModeSwitch } from '../components/SourceModeSwitch'
import { createLrcImport, importSpotify, importYoutube, uploadAudio } from '../lib/api'
import { saveWorkflow } from '../lib/workflow'
import type { SourceMode, WorkflowState } from '../types/api'

export function ImportPage() {
  const navigate = useNavigate()
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [spotifyQuery, setSpotifyQuery] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [lrcFile, setLrcFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (sourceMode === 'upload' && !audioFile) {
      setError('Please choose an audio file before creating a sync job.')
      return
    }

    if (sourceMode === 'youtube' && !youtubeUrl.trim()) {
      setError('Please paste a YouTube watch URL first.')
      return
    }

    if (sourceMode === 'spotify' && !spotifyQuery.trim()) {
      setError('Please paste a Spotify URL or search query first.')
      return
    }

    if (sourceMode === 'upload' && !lrcFile) {
      setError('Please upload an LRC file before creating the player payload.')
      return
    }

    setIsSubmitting(true)

    try {
      const workflowBase: WorkflowState = {
        sourceId: '',
        sourceMode,
      }

      if (sourceMode === 'upload' && audioFile) {
        const source = await uploadAudio(audioFile)
        const lrcImport = await createLrcImport({
          sourceId: source.sourceId,
          lrcText: await lrcFile!.text(),
        })

        const workflow = {
          ...workflowBase,
          sourceId: source.sourceId,
          lrcJobId: lrcImport.jobId,
        }

        saveWorkflow(workflow)
        navigate(`/jobs/${lrcImport.jobId}`)
        return
      }

      if (sourceMode === 'spotify') {
        const source = await importSpotify(spotifyQuery.trim())
        const workflow = {
          ...workflowBase,
          sourceId: source.sourceId,
          sourceJobId: source.jobId,
        }
        saveWorkflow(workflow)
        navigate(`/jobs/${source.jobId}`)
        return
      }

      const source = await importYoutube(youtubeUrl.trim())
      const workflow = {
        ...workflowBase,
        sourceId: source.sourceId,
        sourceJobId: source.jobId,
      }
      saveWorkflow(workflow)
      navigate(`/jobs/${source.jobId}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create a sync job.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageShell
      eyebrow="Phase 1 Web Player"
      title="Dynamic Lyrics studio"
      subtitle="Import a song source, prefer paired bilingual LRC timing when available, and turn the backend flow into a player-ready learning session."
      aside={<Link className="secondary-button" to="/">Back to library</Link>}
    >
      <div className="page-grid">
        <section className="hero-card">
          <span className="eyebrow">Import workflow</span>
          <div className="brand-title">Audio in, timed learning lyrics out.</div>
          <p className="lede">
            Choose a source, prefer synced LRC timing, watch job progress, then rehearse with synchronized lines and optional translation.
          </p>
          <div className="hero-card__meta">
            <div className="metric">
              <strong>3 source paths</strong>
              <span className="muted">Upload audio, import YouTube, or use Spotify metadata through spotdl.</span>
            </div>
            <div className="metric">
              <strong>LRC-first timing</strong>
              <span className="muted">Upload paired bilingual LRC files for the most reliable sync path in the current prototype.</span>
            </div>
            <div className="metric">
              <strong>Translation ready</strong>
              <span className="muted">Paired bilingual LRC translations stay available in the player toggle.</span>
            </div>
          </div>
        </section>

        <form className="split-grid" onSubmit={handleSubmit}>
          <div className="page-grid">
            <SectionCard title="Choose a source" subtitle="Pick the audio route that matches your current workflow.">
              <SourceModeSwitch value={sourceMode} onChange={setSourceMode} />

              <div className="form-grid" style={{ marginTop: 18 }}>
                {sourceMode === 'upload' ? (
                  <div>
                    <label className="field-label" htmlFor="audio-file">Audio file</label>
                    <div className="file-shell">
                      <input
                        id="audio-file"
                        className="file-input"
                        type="file"
                        accept="audio/*"
                        onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                      />
                      <span className="field-help">
                        {audioFile ? `Selected: ${audioFile.name}` : 'Choose a local song file to create a ready source immediately.'}
                      </span>
                    </div>

                    <label className="field-label" htmlFor="lrc-file" style={{ marginTop: 16 }}>LRC file</label>
                    <div className="file-shell">
                      <input
                        id="lrc-file"
                        className="file-input"
                        type="file"
                        accept=".lrc,text/plain"
                        onChange={(event) => setLrcFile(event.target.files?.[0] ?? null)}
                      />
                      <span className="field-help">
                        {lrcFile
                          ? `Selected: ${lrcFile.name}`
                          : 'Required for uploaded audio. Paired bilingual LRC import is the primary timing path.'}
                      </span>
                    </div>
                  </div>
                ) : sourceMode === 'youtube' ? (
                  <div>
                    <label className="field-label" htmlFor="youtube-url">YouTube watch URL</label>
                    <input
                      id="youtube-url"
                      className="field"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(event) => setYoutubeUrl(event.target.value)}
                    />
                    <p className="field-help">Playlist and radio parameters will be stripped before import. Automatic LRC retrieval will be connected in a later backend step.</p>
                  </div>
                ) : (
                  <div>
                    <label className="field-label" htmlFor="spotify-query">Spotify URL or search query</label>
                    <input
                      id="spotify-query"
                      className="field"
                      type="text"
                      placeholder="https://open.spotify.com/track/... or NEWJEANS - Cookie"
                      value={spotifyQuery}
                      onChange={(event) => setSpotifyQuery(event.target.value)}
                    />
                    <p className="field-help">spotdl uses Spotify metadata, then downloads audio through the configured provider.</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Create the sync job" subtitle="The backend imports the source first, then LRC-based flows build the player payload.">
            <div className="quick-list">
              <div className="detail-row">
                <span>Source mode</span>
                <strong>{sourceMode === 'upload' ? 'Upload audio' : sourceMode === 'youtube' ? 'YouTube import' : 'Spotify import'}</strong>
              </div>
              <div className="detail-row">
                <span>Timing input</span>
                <strong>{sourceMode === 'spotify' ? 'spotdl synced LRC' : sourceMode === 'youtube' ? 'Automatic LRC pending' : 'Paired bilingual LRC'}</strong>
              </div>
              <div className="detail-row">
                <span>Translations</span>
                <strong>{sourceMode === 'youtube' ? 'Pending automatic LRC' : 'From LRC if available'}</strong>
              </div>
            </div>

            <div className="actions" style={{ marginTop: 20 }}>
              <div className="muted">
                LRC-based jobs create a player with click-to-seek and translation toggle when translations are available.
              </div>
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Preparing workflow...' : 'Create sync job'}
              </button>
            </div>

            {error ? <div className="error-state" style={{ marginTop: 16 }}>{error}</div> : null}
          </SectionCard>
        </form>
      </div>
    </PageShell>
  )
}
