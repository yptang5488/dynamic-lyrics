import { Navigate, Route, Routes } from 'react-router-dom'
import { ImportPage } from '../pages/ImportPage'
import { JobPage } from '../pages/JobPage'
import { LibraryPage } from '../pages/LibraryPage'
import { PlayerPage } from '../pages/PlayerPage'
import { SpotifyLrcPreviewPage } from '../pages/SpotifyLrcPreviewPage'
import { YoutubeLrcPreviewPage } from '../pages/YoutubeLrcPreviewPage'
import { IS_PRACTICE_MODE } from '../lib/practiceMode'

export function AppRouter() {
  if (IS_PRACTICE_MODE) {
    return (
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/player/:songId" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/jobs/:jobId" element={<JobPage />} />
      <Route path="/spotify-preview/:jobId" element={<SpotifyLrcPreviewPage />} />
      <Route path="/youtube-lrc/:jobId" element={<YoutubeLrcPreviewPage />} />
      <Route path="/player/:songId" element={<PlayerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
