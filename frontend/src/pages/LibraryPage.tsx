import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { deleteSong, listSongs } from '../lib/api'
import { IS_PRACTICE_MODE } from '../lib/practiceMode'
import type { SongCatalogEntry } from '../types/api'

export function LibraryPage() {
  const queryClient = useQueryClient()
  const [isEditingSongs, setIsEditingSongs] = useState(false)
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
      title="Song library"
      subtitle="Pick a maintainer-prepared track and enjoy synced lyrics player!"
      aside={(
        <div className="library-header-actions">
          {IS_PRACTICE_MODE ? null : <Link className="secondary-button" to="/import">Maintainer import</Link>}
          {!IS_PRACTICE_MODE && songsQuery.isSuccess && songsQuery.data.length > 0 ? (
            <button
              type="button"
              className={`chip-button chip-button--compact${isEditingSongs ? ' is-active' : ''}`}
              onClick={() => setIsEditingSongs((isEditing) => !isEditing)}
            >
              {isEditingSongs ? 'Done editing' : 'Edit songs'}
            </button>
          ) : null}
        </div>
      )}
    >
      <div className="page-grid">
        {songsQuery.isLoading ? <div className="empty-state">Loading the private song library...</div> : null}

        {songsQuery.isError ? (
          <div className="error-state">
            {songsQuery.error instanceof Error ? songsQuery.error.message : 'Failed to load the song library.'}
          </div>
        ) : null}

        {songsQuery.isSuccess && songsQuery.data.length === 0 ? (
          <div className="empty-state">
            {IS_PRACTICE_MODE ? 'No practice songs are available in this static export.' : 'No prepared songs are available yet. Use the maintainer import flow to create a player-ready song first.'}
          </div>
        ) : null}

        {songsQuery.isSuccess && songsQuery.data.length > 0 ? (
          <div className="library-grid">
            {songsQuery.data.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                isEditing={isEditingSongs}
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
      </div>
    </PageShell>
  )
}

function SongCard({
  song,
  isEditing,
  isDeleting,
  onDelete,
}: {
  song: SongCatalogEntry
  isEditing: boolean
  isDeleting: boolean
  onDelete: () => void
}) {
  const navigate = useNavigate()

  const openPlayer = () => navigate(song.playerPath)
  const removeSong = () => {
    if (window.confirm(`Remove ${song.title} from the library?`)) {
      onDelete()
    }
  }

  return (
    <article
      className={`song-card${isEditing ? ' song-card--editing' : ''}`}
      role={isEditing ? undefined : 'link'}
      tabIndex={isEditing ? undefined : 0}
      onClick={isEditing ? undefined : openPlayer}
      onKeyDown={(event) => {
        if (!isEditing && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          openPlayer()
        }
      }}
    >
      {isEditing ? (
        <button
          type="button"
          className="song-card__delete-button"
          disabled={isDeleting}
          aria-label={`Remove ${song.title}`}
          onClick={removeSong}
        >
          {isDeleting ? '...' : 'x'}
        </button>
      ) : null}
      <div>
        <h3>{song.title}</h3>
        <p className="muted">{song.artist}</p>
      </div>
      <div className="song-card__badges">
        <span className={`badge badge--compact${song.hasLyrics ? ' badge--ready' : ' badge--queued'}`}>
          {song.hasLyrics ? 'Lyrics' : 'No lyrics'}
        </span>
        {song.hasTranslation ? <span className="badge badge--compact badge--ready">Translation</span> : null}
        {song.hasNotes ? <span className="badge badge--compact badge--ready">Notes</span> : null}
      </div>
    </article>
  )
}
