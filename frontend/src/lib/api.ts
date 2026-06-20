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
import { IS_PRACTICE_MODE } from './practiceMode'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const PRACTICE_SETTINGS_KEY = 'dynamicLyricsPracticeSettings'

interface PracticeManifest {
  songs: Array<SongCatalogEntry & { songUrl: string; audioUrl: string }>
}

interface PracticeSongSettings {
  lyricOffset?: number
  title?: string
  artist?: string
  trimStart?: number
  trimEnd?: number
  lyricNotes?: Record<string, Array<Record<string, unknown>>>
  chantEvents?: SongChantEvent[]
}

interface PracticeSettings {
  version: 1
  songs: Record<string, PracticeSongSettings>
}

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
  if (IS_PRACTICE_MODE) {
    const manifest = await getPracticeManifest()
    const entry = manifest.songs.find((song) => song.id === songId)
    if (!entry) {
      throw new Error('Song not found in this practice export.')
    }

    const response = await fetch(entry.songUrl)
    const song = await parseResponse<SongResponse>(response)
    return applyPracticeSettings(song)
  }

  const response = await fetch(resolveUrl(`/api/songs/${songId}`))
  return parseResponse<SongResponse>(response)
}

export async function listSongs() {
  if (IS_PRACTICE_MODE) {
    const manifest = await getPracticeManifest()
    return manifest.songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      hasLyrics: song.hasLyrics,
      hasTranslation: song.hasTranslation,
      hasNotes: song.hasNotes,
      playerPath: song.playerPath,
    }))
  }

  const response = await fetch(resolveUrl('/api/songs'))
  return parseResponse<SongCatalogEntry[]>(response)
}

export async function deleteSong(songId: string) {
  if (IS_PRACTICE_MODE) {
    throw new Error('Static practice exports cannot remove songs.')
  }

  const response = await fetch(resolveUrl(`/api/songs/${songId}`), {
    method: 'DELETE',
  })

  if (!response.ok) {
    await parseResponse<never>(response)
  }
}

export async function updateSongLyricOffset(songId: string, lyricOffset: number) {
  if (IS_PRACTICE_MODE) {
    updatePracticeSongSettings(songId, { lyricOffset })
    return getSong(songId)
  }

  const response = await fetch(resolveUrl(`/api/songs/${songId}/lyric-offset`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lyricOffset }),
  })

  return parseResponse<SongResponse>(response)
}

export async function shiftSongTiming(songId: string, fromLineId: string, offset: number) {
  if (IS_PRACTICE_MODE) {
    throw new Error('Static practice exports cannot permanently shift song timing.')
  }

  const response = await fetch(resolveUrl(`/api/songs/${songId}/timing-shift`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromLineId, offset }),
  })

  return parseResponse<SongResponse>(response)
}

export async function updateSongMetadata(songId: string, title: string, artist: string, trimStart: number, trimEnd: number) {
  if (IS_PRACTICE_MODE) {
    updatePracticeSongSettings(songId, { title, artist, trimStart, trimEnd })
    return getSong(songId)
  }

  const response = await fetch(resolveUrl(`/api/songs/${songId}/metadata`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, artist, trimStart, trimEnd }),
  })

  return parseResponse<SongResponse>(response)
}

export async function updateSongLyricNotes(
  songId: string,
  lyricNotes: Array<{ lineId: string; notes: Array<Record<string, unknown>> }>,
) {
  if (IS_PRACTICE_MODE) {
    const settings = getPracticeSongSettings(songId)
    const nextLyricNotes = { ...(settings.lyricNotes ?? {}) }
    for (const item of lyricNotes) {
      nextLyricNotes[item.lineId] = item.notes
    }
    updatePracticeSongSettings(songId, { lyricNotes: nextLyricNotes })
    return getSong(songId)
  }

  const response = await fetch(resolveUrl(`/api/songs/${songId}/lyric-notes`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lyricNotes }),
  })

  return parseResponse<SongResponse>(response)
}

export async function updateSongChantEvents(songId: string, chantEvents: SongChantEvent[]) {
  if (IS_PRACTICE_MODE) {
    updatePracticeSongSettings(songId, { chantEvents })
    return getSong(songId)
  }

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

async function getPracticeManifest() {
  const response = await fetch('./practice-data/manifest.json')
  return parseResponse<PracticeManifest>(response)
}

function applyPracticeSettings(song: SongResponse): SongResponse {
  const settings = getPracticeSongSettings(song.id)
  const lyricNotes = settings.lyricNotes ?? {}
  const lyrics = Object.keys(lyricNotes).length
    ? song.lyrics.map((line) => lyricNotes[line.id] ? { ...line, notes: lyricNotes[line.id] } : line)
    : song.lyrics

  return {
    ...song,
    title: settings.title ?? song.title,
    artist: settings.artist ?? song.artist,
    audio: {
      ...song.audio,
      trimStart: settings.trimStart ?? song.audio.trimStart,
      trimEnd: settings.trimEnd ?? song.audio.trimEnd,
    },
    lyrics,
    chantEvents: settings.chantEvents ?? song.chantEvents,
    lyricOffset: settings.lyricOffset ?? song.lyricOffset ?? 0,
  }
}

function getPracticeSongSettings(songId: string) {
  return getPracticeSettings().songs[songId] ?? {}
}

function updatePracticeSongSettings(songId: string, patch: PracticeSongSettings) {
  const settings = getPracticeSettings()
  settings.songs[songId] = { ...(settings.songs[songId] ?? {}), ...patch }
  localStorage.setItem(PRACTICE_SETTINGS_KEY, JSON.stringify(settings))
}

function getPracticeSettings(): PracticeSettings {
  try {
    const settings = JSON.parse(localStorage.getItem(PRACTICE_SETTINGS_KEY) ?? '') as PracticeSettings
    if (settings?.version === 1 && settings.songs) {
      return settings
    }
  } catch {
    // Ignore broken local practice data and start fresh.
  }

  return { version: 1, songs: {} }
}
