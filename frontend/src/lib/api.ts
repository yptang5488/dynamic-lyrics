import type {
  AlignmentRequest,
  JobStatusResponse,
  SongResponse,
  SourceDetailResponse,
  SourceResponse,
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

export async function getSource(sourceId: string) {
  const response = await fetch(resolveUrl(`/api/sources/${sourceId}`))
  return parseResponse<SourceDetailResponse>(response)
}

export async function createAlignment(payload: AlignmentRequest) {
  const response = await fetch(resolveUrl('/api/alignments'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseResponse<{ jobId: string; status: string }>(response)
}

export async function getJob(jobId: string) {
  const response = await fetch(resolveUrl(`/api/jobs/${jobId}`))
  return parseResponse<JobStatusResponse>(response)
}

export async function getSong(songId: string) {
  const response = await fetch(resolveUrl(`/api/songs/${songId}`))
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
