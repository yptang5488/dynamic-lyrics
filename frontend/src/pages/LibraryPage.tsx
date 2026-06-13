import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { SectionCard } from '../components/SectionCard'
import { deleteSong, listSongs } from '../lib/api'
import type { SongCatalogEntry } from '../types/api'

export function LibraryPage() {
  const queryClient = useQueryClient()
  const songsQuery = useQuery({
    queryKey: ['songs'],
    queryFn: listSongs,
  })
  const deleteMutation = useMutation({
    mutationFn: deleteSong,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['songs'] })
    },
  })

  return (
    <PageShell
      eyebrow="Private Library"
      title="Choose a prepared song"
      subtitle="A small, curated song shelf for friends. Pick a maintainer-prepared track and jump straight into the synced lyrics player."
      aside={<Link className="secondary-button" to="/import">Maintainer import</Link>}
    >
      <div className="page-grid">
        <section className="hero-card library-hero">
          <span className="eyebrow">Read-only entry point</span>
          <div className="brand-title">Songs that are already ready to study.</div>
          <p className="lede">
            This library uses existing player-ready songs from the backend. Audio, timing, translations, and shared notes are prepared before they appear here.
          </p>
          <div className="hero-card__meta">
            <div className="metric">
              <strong>{songsQuery.data?.length ?? 0} songs</strong>
              <span className="muted">Currently available from the private backend catalog.</span>
            </div>
            <div className="metric">
              <strong>Player-ready</strong>
              <span className="muted">Each card opens the existing synchronized lyrics player.</span>
            </div>
            <div className="metric">
              <strong>Curated first</strong>
              <span className="muted">Imports stay separate so friends do not need download tools.</span>
            </div>
          </div>
        </section>

        <SectionCard title="Song shelf" subtitle="Select one of the prepared songs below.">
          {songsQuery.isLoading ? <div className="empty-state">Loading the private song library...</div> : null}

          {songsQuery.isError ? (
            <div className="error-state">
              {songsQuery.error instanceof Error ? songsQuery.error.message : 'Failed to load the song library.'}
            </div>
          ) : null}

          {songsQuery.isSuccess && songsQuery.data.length === 0 ? (
            <div className="empty-state">
              No prepared songs are available yet. Use the maintainer import flow to create a player-ready song first.
            </div>
          ) : null}

          {songsQuery.isSuccess && songsQuery.data.length > 0 ? (
            <div className="library-grid">
              {songsQuery.data.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === song.id}
                  onDelete={() => deleteMutation.mutate(song.id)}
                />
              ))}
            </div>
          ) : null}

          {deleteMutation.isError ? (
            <div className="error-state" style={{ marginTop: 14 }}>
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to remove the song.'}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </PageShell>
  )
}

function SongCard({
  song,
  isDeleting,
  onDelete,
}: {
  song: SongCatalogEntry
  isDeleting: boolean
  onDelete: () => void
}) {
  return (
    <article className="song-card">
      <div>
        <span className="eyebrow">{song.language}</span>
        <h3>{song.title}</h3>
        <p className="muted">{song.artist}</p>
      </div>
      <div className="song-card__badges">
        <span className={`badge${song.hasLyrics ? ' badge--ready' : ' badge--queued'}`}>
          {song.hasLyrics ? 'Lyrics' : 'No lyrics'}
        </span>
        {song.hasTranslation ? <span className="badge badge--ready">Translation</span> : null}
        {song.hasNotes ? <span className="badge badge--ready">Notes</span> : null}
      </div>
      <div className="song-card__actions">
        <Link className="primary-button" to={song.playerPath}>Open player</Link>
        <button
          type="button"
          className="ghost-button"
          disabled={isDeleting}
          onClick={() => {
            if (window.confirm(`Remove ${song.title} from the library?`)) {
              onDelete()
            }
          }}
        >
          {isDeleting ? 'Removing...' : 'Remove'}
        </button>
      </div>
    </article>
  )
}
