import type {
  JobStatusResponse,
  SongCatalogEntry,
  SongChantEvent,
  LrcImportRequest,
  SongResponse,
  SourceDetailResponse,
  SourceResponse,
  SpotifyImportResponse,
  SyncedLrcSearchRequest,
  SyncedLrcSearchResponse,
  YoutubeImportResponse,
} from '../types/api'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function resolveUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'Request failed'
    try {
      const payload = (await response.json()) as { detail?: string }
      message = payload.detail ?? message
    } catch {
      message = response.statusText || message
    }
    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function uploadAudio(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(resolveUrl('/api/sources/upload-audio'), {
    method: 'POST',
    body: formData,
  })

  return parseResponse<SourceResponse>(response)
}

export async function importYoutube(url: string) {
  const response = await fetch(resolveUrl('/api/sources/import-youtube'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  return parseResponse<YoutubeImportResponse>(response)
}

export async function importSpotify(query: string) {
  const response = await fetch(resolveUrl('/api/sources/import-spotify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  return parseResponse<SpotifyImportResponse>(response)
}

export async function getSource(sourceId: string) {
  const response = await fetch(resolveUrl(`/api/sources/${sourceId}`))
  return parseResponse<SourceDetailResponse>(response)
}

export async function createLrcImport(payload: LrcImportRequest) {
  const response = await fetch(resolveUrl('/api/alignments/from-lrc'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseResponse<{ jobId: string; status: string }>(response)
}

export async function searchSyncedLrc(payload: SyncedLrcSearchRequest) {
  const response = await fetch(resolveUrl('/api/lyrics/search-synced'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseResponse<SyncedLrcSearchResponse>(response)
}

export async function getJob(jobId: string) {
  const response = await fetch(resolveUrl(`/api/jobs/${jobId}`))
  return parseResponse<JobStatusResponse>(response)
}

export async function getSong(songId: string) {
  const response = await fetch(resolveUrl(`/api/songs/${songId}`))
  return parseResponse<SongResponse>(response)
}

export async function listSongs() {
  const response = await fetch(resolveUrl('/api/songs'))
  return parseResponse<SongCatalogEntry[]>(response)
}

export async function deleteSong(songId: string) {
  const response = await fetch(resolveUrl(`/api/songs/${songId}`), {
    method: 'DELETE',
  })

  if (!response.ok) {
    await parseResponse<never>(response)
  }
}

export async function updateSongLyricOffset(songId: string, lyricOffset: number) {
  const response = await fetch(resolveUrl(`/api/songs/${songId}/lyric-offset`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lyricOffset }),
  })

  return parseResponse<SongResponse>(response)
}

export async function updateSongMetadata(songId: string, title: string, artist: string) {
  const response = await fetch(resolveUrl(`/api/songs/${songId}/metadata`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, artist }),
  })

  return parseResponse<SongResponse>(response)
}

export async function updateSongLyricNotes(
  songId: string,
  lyricNotes: Array<{ lineId: string; notes: Array<Record<string, unknown>> }>,
) {
  const response = await fetch(resolveUrl(`/api/songs/${songId}/lyric-notes`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lyricNotes }),
  })

  return parseResponse<SongResponse>(response)
}

export async function updateSongChantEvents(songId: string, chantEvents: SongChantEvent[]) {
  const response = await fetch(resolveUrl(`/api/songs/${songId}/chant-events`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chantEvents }),
  })

  return parseResponse<SongResponse>(response)
}

export function resolveMediaUrl(path: string) {
  if (!path) {
    return ''
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return resolveUrl(path)
}
