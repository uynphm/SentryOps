import { useState } from 'react'
import { Scan, Zap, Bot } from 'lucide-react'
import UploadPanel from '../components/UploadPanel'
import ScoreGauge from '../components/ScoreGauge'
import RiskTable from '../components/RiskTable'
import ShadowAgentPanel from '../components/ShadowAgentPanel'
import AuditTrail from '../components/AuditTrail'
import RemediationPanel from '../components/RemediationPanel'
import { quickScan, deepScan } from '../api/client'

const TABS = [
    { id: 'findings', label: '⚠️  Findings' },
    { id: 'shadow-agents', label: '🤖 Shadow Agents' },
    { id: 'remediations', label: '🔧 Remediations' },
    { id: 'audit', label: '📋 Audit Trail' },
]

export default function ScanPage() {
    const [mode, setMode] = useState('quick')     // 'quick' | 'deep'
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [quickResult, setQuickResult] = useState(null)
    const [deepResult, setDeepResult] = useState(null)
    const [activeTab, setActiveTab] = useState('findings')

    const result = deepResult || quickResult

    const handleScan = async (files) => {
        setLoading(true)
        setError(null)
        setQuickResult(null)
        setDeepResult(null)

        try {
            if (mode === 'quick') {
                const res = await quickScan(files)
                setQuickResult(res)
            } else {
                // Run quick first, pass findings to deep
                const quick = await quickScan(files)
                setQuickResult(quick)
                const deep = await deepScan(files, quick.findings)
                setDeepResult(deep)
            }
        } catch (err) {
            console.error(err)
            setError(
                err?.response?.data?.detail ||
                err?.message ||
                'Scan failed — make sure the backend is running at localhost:8000'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fade-in">
            <div className="page-title">Run a Security Scan</div>
            <div className="page-subtitle">
                Upload your agent configs, GitHub Actions YAML, MCP files, or paste prompts for adversarial analysis.
            </div>

            {/* Top controls */}
            <div className="glass-panel" style={{ marginBottom: 24 }}>
                {/* Mode selector */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Scan Mode:</div>
                    <button
                        id="mode-quick-btn"
                        className={`btn ${mode === 'quick' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setMode('quick')}
                        type="button"
                    >
                        <Zap size={14} />
                        Quick Scan
                        <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: 4 }}>&lt;5s</span>
                    </button>
                    <button
                        id="mode-deep-btn"
                        className={`btn ${mode === 'deep' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setMode('deep')}
                        type="button"
                    >
                        <Bot size={14} />
                        Deep Scan
                        <span style={{ fontSize: '0.72rem', opacity: 0.7, marginLeft: 4 }}>30–90s</span>
                    </button>

                    {mode === 'deep' && (
                        <div className="alert alert--info" style={{ marginLeft: 8, padding: '8px 14px', fontSize: '0.8rem' }}>
                            <Bot size={14} />
                            <span>3 Shadow Agents (Claude 3.5 Sonnet) will red-team your files.</span>
                        </div>
                    )}
                </div>

                <UploadPanel onFilesReady={handleScan} loading={loading} />

                {error && (
                    <div className="alert alert--error" style={{ marginTop: 16 }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* Loading state */}
            {loading && (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>
                        {mode === 'deep' ? '🤖' : '🔍'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
                        {mode === 'deep' ? 'Shadow Agents Active…' : 'Scanning…'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {mode === 'deep'
                            ? 'Running adversarial red-team analysis in parallel. This takes 30–90 seconds.'
                            : 'Running static detection passes…'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 24 }}>
                        {mode === 'deep' && ['PromptInjector', 'RolePlayEscaper', 'SecretExtractor'].map((name) => (
                            <div key={name} className="agent-card running" style={{ minWidth: 140 }}>
                                <div className="agent-name" style={{ fontSize: '0.8rem' }}>{name}</div>
                                <span className="agent-status-pill running" style={{ marginTop: 8 }}>
                                    <span className="spinner" /> Running
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="fade-in">
                    {/* Score + summary row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 24 }}>
                        <div className="glass-panel glass-panel--glow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ScoreGauge score={result.score?.total ?? 0} grade={result.score?.grade ?? 'F'} />
                        </div>

                        <div className="glass-panel">
                            <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Scan size={16} style={{ color: 'var(--accent-primary)' }} />
                                Scan Summary
                                <span className={`badge ${result.mode === 'deep' ? 'badge--low' : 'badge--info'}`} style={{ marginLeft: 8 }}>
                                    {result.mode === 'deep' ? '🤖 Deep' : '⚡ Quick'}
                                </span>
                            </div>

                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
                                <div className="stat-card" style={{ padding: 14 }}>
                                    <div className="stat-value" style={{ fontSize: '1.5rem', color: result.findings?.length > 0 ? 'var(--sev-high)' : 'var(--accent-green)' }}>
                                        {result.findings?.length ?? 0}
                                    </div>
                                    <div className="stat-label">Findings</div>
                                </div>
                                <div className="stat-card" style={{ padding: 14 }}>
                                    <div className="stat-value" style={{ fontSize: '1.5rem', color: result.shadow_agents?.some(a => a.breach_detected) ? 'var(--sev-critical)' : 'var(--accent-green)' }}>
                                        {result.shadow_agents?.filter(a => a.breach_detected).length ?? 0}
                                    </div>
                                    <div className="stat-label">Breaches</div>
                                </div>
                                <div className="stat-card" style={{ padding: 14 }}>
                                    <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--accent-primary)' }}>
                                        {result.suggestions?.length ?? 0}
                                    </div>
                                    <div className="stat-label">Auto-Fixes</div>
                                </div>
                            </div>

                            {/* Summary text */}
                            {quickResult?.summary && (
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                    {quickResult.summary}
                                </div>
                            )}

                            {result.agent_signals_detected && (
                                <div className="alert alert--info" style={{ marginTop: 12 }}>
                                    <Bot size={14} />
                                    <span>Agent-related signals detected — deep scan recommended if not already run.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="glass-panel">
                        <div className="tabs">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    id={`tab-${tab.id}`}
                                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                    type="button"
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'findings' && (
                            <div className="fade-in">
                                <RiskTable findings={result.findings ?? []} />
                            </div>
                        )}
                        {activeTab === 'shadow-agents' && (
                            <div className="fade-in">
                                <ShadowAgentPanel agents={result.shadow_agents ?? []} />
                            </div>
                        )}
                        {activeTab === 'remediations' && (
                            <div className="fade-in">
                                <RemediationPanel suggestions={result.suggestions ?? []} />
                            </div>
                        )}
                        {activeTab === 'audit' && (
                            <div className="fade-in">
                                <AuditTrail
                                    steps={result.chain_of_thought ?? []}
                                    auditUrl={result.audit_log_url}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
