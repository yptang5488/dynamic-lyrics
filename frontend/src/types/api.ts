export type SourceMode = 'upload' | 'youtube' | 'spotify'

export type SourceStatus = 'queued' | 'processing' | 'ready' | 'failed'

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed'

export type JobType = 'youtube_import' | 'spotify_import' | 'lrc_import'

export interface SourceResponse {
  sourceId: string
  status: SourceStatus
  type: SourceMode
}

export interface SourceDetailResponse {
  id: string
  type: SourceMode
  status: SourceStatus
  title?: string | null
  artist?: string | null
  duration?: number | null
  errorMessage?: string | null
}

export interface YoutubeImportResponse {
  sourceId: string
  jobId: string
  status: JobStatus
}

export interface SpotifyImportResponse {
  sourceId: string
  jobId: string
  status: JobStatus
}

export interface JobStatusResponse {
  id: string
  type: JobType
  status: JobStatus
  progress: number
  message?: string | null
  result?: Record<string, unknown> | null
  errorMessage?: string | null
}

export interface LrcImportRequest {
  sourceId: string
  lrcText: string
}

export interface SyncedLrcSearchRequest {
  query: string
  providers?: string[]
}

export interface SyncedLrcSearchResponse {
  lrcText: string
  warnings: string[]
}

export interface SongAudio {
  sourceId: string
  playbackUrl: string
  duration?: number | null
  trimStart?: number | null
  trimEnd?: number | null
}

export interface SongLyricLine {
  id: string
  start: number
  end: number
  text: string
  translation?: string | null
  confidence: number
  segments: Array<Record<string, unknown>>
  notes: Array<Record<string, unknown>>
}

export interface SongChantEvent {
  id: string
  start: number
  end: number
  text: string
  label: string
  romanizedText?: string | null
}

export interface SongResponse {
  id: string
  title: string
  artist: string
  audio: SongAudio
  lyrics: SongLyricLine[]
  chantEvents: SongChantEvent[]
  lyricOffset: number
}

export interface SongCatalogEntry {
  id: string
  title: string
  artist: string
  hasLyrics: boolean
  hasTranslation: boolean
  hasNotes: boolean
  playerPath: string
}

export interface WorkflowState {
  sourceId: string
  sourceMode: SourceMode
  lrcJobId?: string
  sourceJobId?: string
  songId?: string
}
