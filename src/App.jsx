import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HostPage from './pages/HostPage'
import JoinPage from './pages/JoinPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* /host — shown on the big TV/laptop */}
        <Route path="/host" element={<HostPage />} />
        {/* /join/:roomId — opened by players on their phones */}
        <Route path="/join/:roomId" element={<JoinPage />} />
        {/* Convenience redirect */}
        <Route path="/" element={<Navigate to="/host" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
