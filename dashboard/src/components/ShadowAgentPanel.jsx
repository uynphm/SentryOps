import { Bot, Zap, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const SCENARIO_LABELS = {
    indirect_prompt_injection: 'Indirect Prompt Injection',
    role_play_escape: 'Role-Play Escape',
    secret_extraction: 'Secret Extraction',
}

function StatusPill({ status, breach }) {
    if (status === 'running') return (
        <span className="agent-status-pill running">
            <span className="spinner" /> Running
        </span>
    )
    if (status === 'completed' && breach) return (
        <span className="agent-status-pill" style={{ background: 'rgba(255,59,107,0.15)', color: 'var(--sev-critical)' }}>
            🚨 BREACH
        </span>
    )
    if (status === 'completed') return (
        <span className="agent-status-pill completed">
            <CheckCircle size={10} /> Clean
        </span>
    )
    if (status === 'failed') return (
        <span className="agent-status-pill failed">
            <XCircle size={10} /> Failed
        </span>
    )
    return (
        <span className="agent-status-pill pending">
            <AlertCircle size={10} /> Pending
        </span>
    )
}

/**
 * ShadowAgentPanel — shows each shadow agent's status and findings.
 * @param {{ agents: ShadowAgentState[] }} props
 */
export default function ShadowAgentPanel({ agents = [] }) {
    if (!agents.length) {
        return (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <Bot size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div>No shadow agents launched. Run a deep scan to activate red-team analysis.</div>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agents.map((agent) => (
                <div
                    key={agent.agent_id}
                    className={`agent-card ${agent.breach_detected ? 'breach' : agent.status === 'running' ? 'running' : 'clean'}`}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                            <div className="agent-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                                {agent.name}
                            </div>
                            <div className="agent-scenario">
                                {SCENARIO_LABELS[agent.scenario] || agent.scenario}
                            </div>
                        </div>
                        <StatusPill status={agent.status} breach={agent.breach_detected} />
                    </div>

                    {agent.breach_detected && agent.breach_details && (
                        <div style={{
                            background: 'rgba(255,59,107,0.08)',
                            border: '1px solid rgba(255,59,107,0.25)',
                            borderRadius: 8, padding: '10px 14px',
                            fontSize: '0.8rem', color: '#ff8fa8',
                            lineHeight: 1.6,
                        }}>
                            <strong style={{ display: 'block', marginBottom: 4 }}>Breach Details:</strong>
                            {agent.breach_details.slice(0, 400)}{agent.breach_details.length > 400 ? '…' : ''}
                        </div>
                    )}

                    {agent.steps?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                            {agent.steps.map((step, i) => (
                                <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginBottom: 4 }}>
                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{step.action}</span>
                                    <span>{step.reasoning}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
