import { Clock, Brain } from 'lucide-react'

const AGENT_ICONS = {
    StaticScanner: '🔍',
    Orchestrator: '🎯',
    Remediator: '🔧',
    Scorer: '📊',
}

/**
 * AuditTrail — shows the full chain-of-thought from the scan pipeline.
 * @param {{ steps: AgentStep[], auditUrl?: string }} props
 */
export default function AuditTrail({ steps = [], auditUrl }) {
    if (!steps.length) {
        return (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <Brain size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div>No audit trail yet. Run a scan to see the chain-of-thought.</div>
            </div>
        )
    }

    return (
        <div>
            {auditUrl && (
                <div className="alert alert--info" style={{ marginBottom: 20 }}>
                    <span>🗄</span>
                    <span>
                        Immutable audit log stored:{' '}
                        <a href={auditUrl} target="_blank" rel="noreferrer"
                            style={{ color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                            {auditUrl.slice(0, 80)}…
                        </a>
                    </span>
                </div>
            )}

            <div className="audit-timeline">
                {steps.map((step, i) => (
                    <div key={i} className="audit-step slide-in" style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className="audit-dot" title={step.agent_name}>
                            {AGENT_ICONS[step.agent_name] || '🤖'}
                        </div>
                        <div className="audit-content">
                            <div className="audit-agent">{step.agent_name}</div>
                            <div className="audit-action">{step.action.replace(/_/g, ' ')}</div>
                            <div className="audit-reasoning">{step.reasoning}</div>
                            {step.result && (
                                <div className="audit-result">→ {step.result}</div>
                            )}
                            {step.timestamp && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={10} />
                                    {new Date(step.timestamp).toLocaleTimeString()}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
