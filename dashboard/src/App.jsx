import { Routes, Route, NavLink } from 'react-router-dom'
import { Shield, Scan, BookOpen, Activity, Bell } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ScanPage from './pages/ScanPage'

export default function App() {
  return (
    <div className="app-layout">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="header">
        <a href="/" className="logo" style={{ textDecoration: 'none' }}>
          <div className="logo-icon">🛡</div>
          <span>Sentry<span className="logo-accent">Ops</span></span>
        </a>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            v0.1.0
          </span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent-green)',
            boxShadow: '0 0 8px var(--accent-green)'
          }} title="API Online" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>API Online</span>
        </div>
      </header>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="nav-section">
          <div className="nav-label">Navigation</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Activity size={16} />
            Dashboard
          </NavLink>
          <NavLink
            to="/scan"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Scan size={16} />
            Run a Scan
          </NavLink>
        </div>

        <div className="nav-section" style={{ marginTop: 16 }}>
          <div className="nav-label">Info</div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="nav-item"
          >
            <BookOpen size={16} />
            API Docs
          </a>
        </div>

        {/* Sidebar footer */}
        <div style={{ marginTop: 'auto', padding: '20px 12px', borderTop: '1px solid var(--border-subtle)', marginTop: 32 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Shield size={12} />
              <span style={{ fontWeight: 600 }}>SentryOps</span>
            </div>
            <div>AI Security Governance</div>
            <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
              Claude 3.5 + Gemini 1.5
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<ScanPage />} />
        </Routes>
      </main>
    </div>
  )
}
