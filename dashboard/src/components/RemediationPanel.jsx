import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button onClick={copy} className="btn btn--secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
    )
}

/**
 * RemediationPanel — shows hardened prompt/config suggestions.
 * @param {{ suggestions: Suggestion[] }} props
 */
export default function RemediationPanel({ suggestions = [] }) {
    const [selected, setSelected] = useState(0)

    if (!suggestions.length) {
        return (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔧</div>
                <div>No remediation suggestions. Either no deep scan has run, or no exploitable issues were found.</div>
            </div>
        )
    }

    const s = suggestions[selected]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Suggestion selector */}
            {suggestions.length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {suggestions.map((sug, i) => (
                        <button
                            key={i}
                            onClick={() => setSelected(i)}
                            className={`btn ${i === selected ? 'btn--primary' : 'btn--secondary'}`}
                            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                            type="button"
                        >
                            Fix {i + 1}: {sug.title.slice(0, 30)}{sug.title.length > 30 ? '…' : ''}
                        </button>
                    ))}
                </div>
            )}

            {/* Selected suggestion */}
            <div className="glass-panel fade-in" key={selected}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                        <div style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                            {s.file}:{s.line}
                        </div>
                    </div>
                    <span className="badge badge--info">🛡 Hardened</span>
                </div>

                {/* Explanation */}
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
                    {s.body.split('```suggestion')[0].replace(/\*\*/g, '')}
                </div>

                {/* Hardened content */}
                {s.hardened_content && (
                    <div className="code-viewer">
                        <div className="code-header">
                            <span className="code-filename">📄 Hardened Replacement</span>
                            <CopyButton text={s.hardened_content} />
                        </div>
                        <div className="code-body">{s.hardened_content}</div>
                    </div>
                )}

                {/* GitHub suggestion block */}
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        GitHub PR Comment Body
                    </div>
                    <div className="code-viewer">
                        <div className="code-header">
                            <span className="code-filename">Ready to post as a PR review comment</span>
                            <CopyButton text={s.body} />
                        </div>
                        <div className="code-body">{s.body}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
