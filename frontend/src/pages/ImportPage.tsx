import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { SectionCard } from '../components/SectionCard'
import { SourceModeSwitch } from '../components/SourceModeSwitch'
import { createAlignment, importYoutube, uploadAudio } from '../lib/api'
import { saveWorkflow } from '../lib/workflow'
import type { SourceMode, WorkflowState } from '../types/api'

const languageOptions = [
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
]

export function ImportPage() {
  const navigate = useNavigate()
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload')
  const [language, setLanguage] = useState('ja')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [lyricsText, setLyricsText] = useState('')
  const [translationsText, setTranslationsText] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
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

    if (!lyricsText.trim()) {
      setError('Please paste the original lyrics before continuing.')
      return
    }

    setIsSubmitting(true)

    try {
      const workflowBase: WorkflowState = {
        sourceId: '',
        sourceMode,
        language,
        lyricsText,
        translationsText,
      }

      if (sourceMode === 'upload' && audioFile) {
        const source = await uploadAudio(audioFile)
        const alignment = await createAlignment({
          sourceId: source.sourceId,
          language,
          lyricsText,
          translations: toTranslations(translationsText),
        })

        const workflow = {
          ...workflowBase,
          sourceId: source.sourceId,
          alignmentJobId: alignment.jobId,
        }

        saveWorkflow(workflow)
        navigate(`/jobs/${alignment.jobId}`)
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
      subtitle="Import a song source, paste matching lyrics, and turn the backend timing flow into a player-ready learning session."
      aside={<span className="eyebrow">Backend-connected prototype</span>}
    >
      <div className="page-grid">
        <section className="hero-card">
          <span className="eyebrow">Import workflow</span>
          <div className="brand-title">Audio in, timed learning lyrics out.</div>
          <p className="lede">
            This first frontend pass focuses on the full learner journey: choose a source, submit lyrics, watch job progress,
            then rehearse with synchronized lines and optional translation.
          </p>
          <div className="hero-card__meta">
            <div className="metric">
              <strong>2 source paths</strong>
              <span className="muted">Upload audio or import a single YouTube watch URL.</span>
            </div>
            <div className="metric">
              <strong>Line-based sync</strong>
              <span className="muted">Current backend uses mock timing but keeps the final player contract stable.</span>
            </div>
            <div className="metric">
              <strong>Translation ready</strong>
              <span className="muted">Paste translations now and toggle them in the player later.</span>
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
                  </div>
                ) : (
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
                    <p className="field-help">Playlist and radio parameters will be stripped before import.</p>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Lyric setup" subtitle="Prepare the content that will be aligned and displayed in the player.">
              <div className="field-row field-row--dual">
                <div>
                  <label className="field-label" htmlFor="language">Lyric language</label>
                  <select
                    id="language"
                    className="select"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="translation-hint">Translation mode</label>
                  <input id="translation-hint" className="field" value="Optional, line-by-line" readOnly />
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: 16 }}>
                <div>
                  <label className="field-label" htmlFor="lyrics">Original lyrics</label>
                  <textarea
                    id="lyrics"
                    className="textarea"
                    placeholder={'Line 1\nLine 2\nLine 3'}
                    value={lyricsText}
                    onChange={(event) => setLyricsText(event.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="translations">Translations</label>
                  <textarea
                    id="translations"
                    className="textarea"
                    placeholder={'Translation 1\nTranslation 2\nTranslation 3'}
                    value={translationsText}
                    onChange={(event) => setTranslationsText(event.target.value)}
                  />
                  <p className="field-help">Keep the same number of non-empty lines as the original lyrics.</p>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Create the sync job" subtitle="The backend will import the source first, then build line-level timings for the player.">
            <div className="quick-list">
              <div className="detail-row">
                <span>Source mode</span>
                <strong>{sourceMode === 'upload' ? 'Upload audio' : 'YouTube import'}</strong>
              </div>
              <div className="detail-row">
                <span>Lyric language</span>
                <strong>{language.toUpperCase()}</strong>
              </div>
              <div className="detail-row">
                <span>Translations</span>
                <strong>{translationsText.trim() ? 'Included' : 'Hidden for now'}</strong>
              </div>
            </div>

            <div className="actions" style={{ marginTop: 20 }}>
              <div className="muted">
                After the job finishes, the player will let you replay from any lyric line and toggle translations instantly.
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

function toTranslations(value: string) {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.length ? lines : undefined
}
