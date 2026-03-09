export type SourceMode = 'upload' | 'youtube'

export type SourceStatus = 'queued' | 'processing' | 'ready' | 'failed'

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed'

export type JobType = 'youtube_import' | 'alignment' | 'lrc_import'

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

export interface JobStatusResponse {
  id: string
  type: JobType
  status: JobStatus
  progress: number
  message?: string | null
  result?: Record<string, unknown> | null
  errorMessage?: string | null
}

export interface AlignmentRequest {
  sourceId: string
  language: string
  lyricsText: string
  translations?: string[]
}

export interface LrcImportRequest {
  sourceId: string
  language: string
  lrcText: string
}

export interface SongAudio {
  sourceId: string
  playbackUrl: string
  duration?: number | null
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

export interface SongResponse {
  id: string
  title: string
  artist: string
  audio: SongAudio
  lyrics: SongLyricLine[]
}

export interface WorkflowState {
  sourceId: string
  sourceMode: SourceMode
  language: string
  lyricsText: string
  translationsText: string
  alignmentJobId?: string
  sourceJobId?: string
  songId?: string
}
