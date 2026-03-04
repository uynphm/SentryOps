import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Shield, AlertTriangle, CheckCircle, Zap,
    TrendingUp, GitPullRequest, Clock
} from 'lucide-react'
import ScoreGauge from '../components/ScoreGauge'
import { getHealth } from '../api/client'

// ── Mock recent scan history for visual demo ────────────────────────────────
const MOCK_HISTORY = [
    {
        scan_id: 'abc-001',
        repo: 'org/copilot-extension',
        pr: 42,
        score: { total: 34, grade: 'F' },
        mode: 'deep',
        findings: 8,
        breaches: 2,
        scanned_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        scan_id: 'abc-002',
        repo: 'org/api-gateway',
        pr: 17,
        score: { total: 78, grade: 'C' },
        mode: 'quick',
        findings: 3,
        breaches: 0,
        scanned_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
        scan_id: 'abc-003',
        repo: 'org/agent-config',
        pr: 91,
        score: { total: 91, grade: 'A' },
        mode: 'deep',
        findings: 1,
        breaches: 0,
        scanned_at: new Date(Date.now() - 86400000).toISOString(),
    },
]

function ScoreTag({ score }) {
    const color = score >= 80 ? 'var(--grade-a)' : score >= 60 ? 'var(--grade-c)' : 'var(--sev-critical)'
    return (
        <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            color, fontSize: '0.9rem',
        }}>
            {score}/100
        </span>
    )
}

function StatCard({ icon, label, value, sub, color }) {
    return (
        <div className="stat-card">
            <div style={{ fontSize: '1.5rem' }}>{icon}</div>
            <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
            <div className="stat-label">{label}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    )
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [apiOnline, setApiOnline] = useState(null)

    useEffect(() => {
        getHealth()
            .then(() => setApiOnline(true))
            .catch(() => setApiOnline(false))
    }, [])

    const avgScore = Math.round(
        MOCK_HISTORY.reduce((s, h) => s + h.score.total, 0) / MOCK_HISTORY.length
    )
    const totalBreaches = MOCK_HISTORY.reduce((s, h) => s + h.breaches, 0)
    const totalFindings = MOCK_HISTORY.reduce((s, h) => s + h.findings, 0)

    return (
        <div className="fade-in">
            <div className="page-title">Security Dashboard</div>
            <div className="page-subtitle">
                Real-time AI agent governance across your GitHub repositories.
            </div>

            {/* API status banner */}
            {apiOnline === false && (
                <div className="alert alert--error" style={{ marginBottom: 24 }}>
                    <AlertTriangle size={16} />
                    <span>
                        Backend API is offline (localhost:8000). Start it with{' '}
                        <code>uvicorn app.main:app --reload</code> before scanning.
                    </span>
                </div>
            )}
            {apiOnline === true && (
                <div className="alert alert--success" style={{ marginBottom: 24 }}>
                    <CheckCircle size={16} />
                    <span>SentryOps API is online and ready.</span>
                </div>
            )}

            {/* Stats row */}
            <div className="stats-grid" style={{ marginBottom: 28 }}>
                <StatCard icon="🔍" label="Total Scans" value={MOCK_HISTORY.length} sub="Last 7 days" />
                <StatCard icon="⚠️" label="Total Findings" value={totalFindings} color="var(--sev-high)" />
                <StatCard icon="🚨" label="Confirmed Breaches" value={totalBreaches} color="var(--sev-critical)" />
                <StatCard icon="📊" label="Avg Score" value={`${avgScore}/100`} color={avgScore >= 70 ? 'var(--grade-b)' : 'var(--sev-high)'} />
            </div>

            {/* Main panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 28 }}>
                {/* Score gauge */}
                <div className="glass-panel glass-panel--glow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Average Score
                    </div>
                    <ScoreGauge score={avgScore} grade={avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F'} />
                    <button
                        className="btn btn--primary"
                        onClick={() => navigate('/scan')}
                        style={{ width: '100%', justifyContent: 'center' }}
                        id="dashboard-scan-btn"
                    >
                        <Shield size={15} />
                        Run New Scan
                    </button>
                </div>

                {/* Quick reference */}
                <div className="glass-panel">
                    <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={16} style={{ color: 'var(--accent-primary)' }} />
                        How SentryOps Works
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[
                            { step: '1', icon: '🔍', title: 'Static Pass', desc: 'Entropy + pattern scan for secrets, injections, and obfuscation in every PR. <5s.' },
                            { step: '2', icon: '🤖', title: 'Shadow Agents', desc: 'Claude 3.5 Sonnet launches 3 adversarial agents to red-team agent configs and prompts in parallel.' },
                            { step: '3', icon: '📊', title: 'Security Score', desc: 'Dynamic 0–100 confidence score posted as a GitHub Check Run with grade A–F.' },
                            { step: '4', icon: '🔧', title: 'Auto-Remediation', desc: 'Gemini generates hardened prompts and posts one-click GitHub Suggestion comments.' },
                        ].map((item) => (
                            <div key={item.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                    background: 'rgba(0,212,255,0.08)',
                                    border: '1px solid var(--border-active)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1rem',
                                }}>
                                    {item.icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 2 }}>{item.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent scan history */}
            <div className="glass-panel">
                <div style={{ fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
                    Recent Scans
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Demo data — connect your GitHub to populate
                    </span>
                </div>
                <table className="risk-table">
                    <thead>
                        <tr>
                            <th>Repository / PR</th>
                            <th>Mode</th>
                            <th>Score</th>
                            <th>Findings</th>
                            <th>Breaches</th>
                            <th>Scanned</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_HISTORY.map((h) => (
                            <tr key={h.scan_id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <GitPullRequest size={14} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontWeight: 600 }}>{h.repo}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{h.pr}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge ${h.mode === 'deep' ? 'badge--low' : 'badge--info'}`}>
                                        {h.mode === 'deep' ? '🤖 Deep' : '⚡ Quick'}
                                    </span>
                                </td>
                                <td><ScoreTag score={h.score.total} /></td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{h.findings}</td>
                                <td>
                                    {h.breaches > 0 ? (
                                        <span style={{ color: 'var(--sev-critical)', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                                            🚨 {h.breaches}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--accent-green)' }}>✓ 0</span>
                                    )}
                                </td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {new Date(h.scanned_at).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
