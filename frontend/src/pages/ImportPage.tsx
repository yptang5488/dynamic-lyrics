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
        <form className="page-grid" onSubmit={handleSubmit}>
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

          {error ? <div className="error-state">{error}</div> : null}

          <div className="actions" style={{ justifyContent: 'flex-end' }}>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Preparing workflow...' : 'Create sync job'}
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  )
}
