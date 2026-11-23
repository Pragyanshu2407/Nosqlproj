import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ScanProject from './pages/ScanProject.jsx'
import Results from './pages/Results.jsx'

export default function App() {
  const location = useLocation()
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      {/* key on the path so each page re-plays its entrance animation */}
      <main key={location.pathname} className="min-w-0 max-w-[1200px] flex-1 px-5 py-8 md:px-10 md:py-10">
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<ScanProject />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </main>
    </div>
  )
}
