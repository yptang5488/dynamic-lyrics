import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { SectionCard } from '../components/SectionCard'
import { SourceModeSwitch } from '../components/SourceModeSwitch'
import { createAlignment, createLrcImport, importYoutube, uploadAudio } from '../lib/api'
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

    if (sourceMode === 'upload' && !lrcFile && !lyricsText.trim()) {
      setError('Please upload an LRC file or paste the original lyrics before continuing.')
      return
    }

    if (sourceMode === 'youtube' && !lyricsText.trim()) {
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
        const alignment = lrcFile
          ? await createLrcImport({
              sourceId: source.sourceId,
              language,
              lrcText: await lrcFile.text(),
            })
          : await createAlignment({
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
      subtitle="Import a song source, prefer paired bilingual LRC timing when available, and turn the backend flow into a player-ready learning session."
      aside={<span className="eyebrow">Backend-connected prototype</span>}
    >
      <div className="page-grid">
        <section className="hero-card">
          <span className="eyebrow">Import workflow</span>
          <div className="brand-title">Audio in, timed learning lyrics out.</div>
          <p className="lede">
            This first frontend pass focuses on the full learner journey: choose a source, upload an LRC file or submit lyrics,
            watch job progress, then rehearse with synchronized lines and optional translation.
          </p>
          <div className="hero-card__meta">
            <div className="metric">
              <strong>2 source paths</strong>
              <span className="muted">Upload audio or import a single YouTube watch URL.</span>
            </div>
            <div className="metric">
              <strong>LRC-first timing</strong>
              <span className="muted">Upload paired bilingual LRC files for the most reliable sync path in the current prototype.</span>
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
                          : 'Optional but recommended. Paired bilingual LRC import is the primary timing path.'}
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

            <SectionCard title="Lyric setup" subtitle="Upload an LRC file for timing, or use pasted lyrics as the fallback alignment path.">
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
                  <input id="translation-hint" className="field" value={lrcFile ? 'Embedded in paired bilingual LRC' : 'Optional, line-by-line'} readOnly />
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: 16 }}>
                <div>
                  <label className="field-label" htmlFor="lyrics">Original lyrics</label>
                  <textarea
                    id="lyrics"
                    className="textarea"
                    placeholder={lrcFile ? 'Optional fallback if you want to compare against the uploaded LRC.' : 'Line 1\nLine 2\nLine 3'}
                    value={lyricsText}
                    onChange={(event) => setLyricsText(event.target.value)}
                  />
                  <p className="field-help">
                    {lrcFile
                      ? 'When an LRC file is uploaded, the backend uses it as the primary timing source.'
                      : 'Paste the original lyrics if you are not using an LRC file.'}
                  </p>
                </div>
                <div>
                  <label className="field-label" htmlFor="translations">Translations</label>
                  <textarea
                    id="translations"
                    className="textarea"
                    placeholder={'Translation 1\nTranslation 2\nTranslation 3'}
                    value={translationsText}
                    onChange={(event) => setTranslationsText(event.target.value)}
                    disabled={Boolean(lrcFile)}
                  />
                  <p className="field-help">
                    {lrcFile
                      ? 'Translation lines come from the paired bilingual LRC in the current primary workflow.'
                      : 'Keep the same number of non-empty lines as the original lyrics.'}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Create the sync job" subtitle="The backend will import the source first, then use LRC timing or fallback alignment to build the player payload.">
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
                <span>Timing input</span>
                <strong>{lrcFile ? 'Paired bilingual LRC' : 'Pasted lyrics'}</strong>
              </div>
              <div className="detail-row">
                <span>Translations</span>
                <strong>{lrcFile ? 'From LRC' : translationsText.trim() ? 'Included' : 'Hidden for now'}</strong>
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
