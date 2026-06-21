import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ImportPage } from '../pages/ImportPage'
import { JobPage } from '../pages/JobPage'
import { LibraryPage } from '../pages/LibraryPage'
import { PlayerPage } from '../pages/PlayerPage'
import { SpotifyLrcPreviewPage } from '../pages/SpotifyLrcPreviewPage'
import { YoutubeLrcPreviewPage } from '../pages/YoutubeLrcPreviewPage'
import { IS_PRACTICE_MODE } from '../lib/practiceMode'

type ThemeName = 'soft-sage' | 'classic'

const THEME_STORAGE_KEY = 'dynamic-lyrics:theme'

function getInitialTheme(): ThemeName {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'classic' ? 'classic' : 'soft-sage'
}

export function AppRouter() {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const routes = IS_PRACTICE_MODE ? (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/player/:songId" element={<PlayerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  ) : (
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

  return (
    <>
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme((value) => (value === 'soft-sage' ? 'classic' : 'soft-sage'))}
      >
        Theme: {theme === 'soft-sage' ? 'Soft sage' : 'Classic'}
      </button>
      {routes}
    </>
  )
}
