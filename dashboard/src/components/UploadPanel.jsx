import { useState, useRef } from 'react'
import { Upload, FileText, X, Plus } from 'lucide-react'

/**
 * UploadPanel — drag-and-drop or text-paste input for files to scan.
 *
 * Calls onFilesReady(files) where files = [{filename, content}]
 */
export default function UploadPanel({ onFilesReady, loading }) {
    const [files, setFiles] = useState([])       // {filename, content}
    const [dragOver, setDragOver] = useState(false)
    const [pasteMode, setPasteMode] = useState(false)
    const [pasteFilename, setPasteFilename] = useState('pasted_content.md')
    const [pasteContent, setPasteContent] = useState('')
    const fileInputRef = useRef()

    // ── File reading helper ──────────────────────────────────────────────────
    const readFile = (file) =>
        new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve({ filename: file.name, content: e.target.result })
            reader.readAsText(file)
        })

    const addFiles = async (rawFiles) => {
        const parsed = await Promise.all(Array.from(rawFiles).map(readFile))
        setFiles((prev) => {
            const names = new Set(prev.map((f) => f.filename))
            return [...prev, ...parsed.filter((f) => !names.has(f.filename))]
        })
    }

    // ── Drag & drop ─────────────────────────────────────────────────────────
    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        addFiles(e.dataTransfer.files)
    }

    // ── Paste mode ───────────────────────────────────────────────────────────
    const addPasted = () => {
        if (!pasteContent.trim()) return
        setFiles((prev) => [...prev, { filename: pasteFilename, content: pasteContent }])
        setPasteContent('')
        setPasteMode(false)
    }

    const removeFile = (filename) =>
        setFiles((prev) => prev.filter((f) => f.filename !== filename))

    const handleSubmit = () => {
        if (files.length) onFilesReady(files)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Drop zone */}
            <div
                className={`drop-zone ${dragOver ? 'active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
            >
                <div className="drop-zone-icon">📂</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Drop files here or click to browse</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Supports: .py, .yml, .yaml, .json, .md, .txt, .js, .ts
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".py,.yml,.yaml,.json,.md,.txt,.js,.ts,.jsx,.tsx"
                    style={{ display: 'none' }}
                    onChange={(e) => addFiles(e.target.files)}
                    id="file-upload-input"
                />
            </div>

            {/* Paste mode toggle */}
            <button
                className="btn btn--secondary"
                onClick={() => setPasteMode((v) => !v)}
                style={{ alignSelf: 'flex-start' }}
                type="button"
            >
                <Plus size={14} />
                Paste content manually
            </button>

            {pasteMode && (
                <div className="glass-panel fade-in" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="paste-filename">Filename</label>
                        <input
                            id="paste-filename"
                            className="form-input"
                            value={pasteFilename}
                            onChange={(e) => setPasteFilename(e.target.value)}
                            placeholder="e.g. mcp.json or system_prompt.md"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="paste-content">Content</label>
                        <textarea
                            id="paste-content"
                            className="form-textarea"
                            value={pasteContent}
                            onChange={(e) => setPasteContent(e.target.value)}
                            placeholder="Paste your agent config, YAML workflow, or prompt here..."
                            rows={8}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn--primary" onClick={addPasted} type="button">
                            <Plus size={14} /> Add File
                        </button>
                        <button className="btn btn--secondary" onClick={() => setPasteMode(false)} type="button">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* File list */}
            {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Files queued ({files.length}):
                    </div>
                    {files.map((f) => (
                        <div key={f.filename} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: 'var(--bg-surface)', borderRadius: 10,
                            padding: '10px 14px', border: '1px solid var(--border-glass)'
                        }}>
                            <FileText size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', flex: 1 }}>
                                {f.filename}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {(f.content.length / 1024).toFixed(1)} KB
                            </span>
                            <button
                                onClick={() => removeFile(f.filename)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                                type="button"
                                title="Remove file"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Submit */}
            <button
                className="btn btn--primary"
                onClick={handleSubmit}
                disabled={loading || files.length === 0}
                id="run-scan-btn"
                style={{ alignSelf: 'flex-start' }}
                type="button"
            >
                {loading ? (
                    <><span className="spinner" style={{ borderColor: '#000', borderTopColor: 'transparent' }} /> Scanning…</>
                ) : (
                    <><Upload size={15} /> Run Scan</>
                )}
            </button>
        </div>
    )
}
