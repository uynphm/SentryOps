import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }

function SeverityBadge({ severity }) {
    return (
        <span className={`badge badge--${severity.toLowerCase()}`}>
            {severity === 'CRITICAL' && '🚨 '}
            {severity === 'HIGH' && '⚠️ '}
            {severity}
        </span>
    )
}

function FindingRow({ finding }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <>
            <tr
                onClick={() => setExpanded((v) => !v)}
                style={{ cursor: 'pointer' }}
            >
                <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span style={{ fontWeight: 600 }}>{finding.title}</span>
                    </div>
                    {finding.file && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, paddingLeft: 22, fontFamily: 'JetBrains Mono, monospace' }}>
                            {finding.file}{finding.line ? `:${finding.line}` : ''}
                        </div>
                    )}
                </td>
                <td><SeverityBadge severity={finding.severity} /></td>
                <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {finding.category.replace(/_/g, ' ')}
                    </span>
                </td>
                <td>
                    {finding.exploitable ? (
                        <span className="exploitable-dot yes" style={{ color: 'var(--sev-critical)' }}>Confirmed</span>
                    ) : (
                        <span className="exploitable-dot no" style={{ color: 'var(--accent-green)' }}>No</span>
                    )}
                </td>
                <td className="evidence">{finding.evidence || '—'}</td>
            </tr>
            {expanded && (
                <tr className="fade-in">
                    <td colSpan={5}>
                        <div style={{
                            background: 'var(--bg-base)', borderRadius: 10,
                            padding: '14px 18px', margin: '4px 0 8px',
                            display: 'flex', flexDirection: 'column', gap: 10
                        }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {finding.description}
                            </p>
                            {finding.evidence && (
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                        Evidence
                                    </div>
                                    <div className="code-body" style={{ maxHeight: 100, borderRadius: 8, background: '#0a0f1a', border: '1px solid var(--border-subtle)' }}>
                                        {finding.evidence}
                                    </div>
                                </div>
                            )}
                            {finding.cwe && (
                                <a
                                    href={`https://cwe.mitre.org/data/definitions/${finding.cwe.replace('CWE-', '')}.html`}
                                    target="_blank" rel="noreferrer"
                                    style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                    <ExternalLink size={12} />
                                    {finding.cwe}
                                </a>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}

/**
 * RiskTable — sortable findings table with expandable rows.
 * @param {{ findings: Finding[] }} props
 */
export default function RiskTable({ findings = [] }) {
    const [filterSev, setFilterSev] = useState('ALL')

    const sorted = [...findings]
        .filter((f) => filterSev === 'ALL' || f.severity === filterSev)
        .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))

    if (!findings.length) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <AlertTriangle size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div>No findings to display.</div>
            </div>
        )
    }

    return (
        <div>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((s) => {
                    const count = s === 'ALL' ? findings.length : findings.filter(f => f.severity === s).length
                    return (
                        <button
                            key={s}
                            onClick={() => setFilterSev(s)}
                            className={`badge badge--${s.toLowerCase()}`}
                            style={{
                                cursor: 'pointer',
                                border: filterSev === s ? '2px solid currentColor' : undefined,
                                opacity: count === 0 ? 0.3 : 1,
                                fontFamily: 'inherit',
                            }}
                        >
                            {s} ({count})
                        </button>
                    )
                })}
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="risk-table">
                    <thead>
                        <tr>
                            <th>Finding</th>
                            <th>Severity</th>
                            <th>Category</th>
                            <th>Exploitable</th>
                            <th>Evidence</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((f) => (
                            <FindingRow key={f.id} finding={f} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
