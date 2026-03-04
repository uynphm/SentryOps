/**
 * ScoreGauge — animated SVG circular gauge for the Security Confidence Score.
 * @param {{ score: number, grade: string }} props
 */
export default function ScoreGauge({ score = 0, grade = 'F' }) {
    const radius = 56
    const circumference = 2 * Math.PI * radius
    const clampedScore = Math.max(0, Math.min(100, score))
    const offset = circumference - (clampedScore / 100) * circumference

    const gradeColor = {
        A: 'var(--grade-a)',
        B: 'var(--grade-b)',
        C: 'var(--grade-c)',
        D: 'var(--grade-d)',
        F: 'var(--grade-f)',
    }[grade] || 'var(--text-muted)'

    return (
        <div className="score-gauge-wrapper">
            <svg
                className="score-gauge-svg"
                width="140"
                height="140"
                viewBox="0 0 140 140"
                style={{ color: gradeColor }}
            >
                {/* Track */}
                <circle
                    cx="70" cy="70" r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="10"
                />
                {/* Progress arc */}
                <circle
                    cx="70" cy="70" r={radius}
                    fill="none"
                    stroke={gradeColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${gradeColor})` }}
                />
                {/* Centre text */}
                <text x="70" y="64" textAnchor="middle" fill={gradeColor}
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 26 }}>
                    {clampedScore}
                </text>
                <text x="70" y="82" textAnchor="middle" fill="var(--text-muted)"
                    style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2 }}>
                    /100
                </text>
            </svg>

            <div style={{ textAlign: 'center' }}>
                <div className="score-grade" style={{ color: gradeColor }}>Grade {grade}</div>
                <div className="score-label">Security Confidence</div>
            </div>
        </div>
    )
}
