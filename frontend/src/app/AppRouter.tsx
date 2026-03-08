import { Navigate, Route, Routes } from 'react-router-dom'
import { ImportPage } from '../pages/ImportPage'
import { JobPage } from '../pages/JobPage'
import { PlayerPage } from '../pages/PlayerPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<ImportPage />} />
      <Route path="/jobs/:jobId" element={<JobPage />} />
      <Route path="/player/:songId" element={<PlayerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
