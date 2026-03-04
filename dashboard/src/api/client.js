import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_KEY = import.meta.env.VITE_API_KEY || ''

const client = axios.create({
    baseURL: BASE,
    headers: {
        Authorization: API_KEY ? `Bearer ${API_KEY}` : undefined,
        'Content-Type': 'application/json',
    },
    timeout: 300_000,   // 5 min — deep scans can be slow
})

/**
 * Quick static scan.
 * @param {Array<{filename: string, content: string}>} files
 */
export const quickScan = (files) =>
    client.post('/api/v1/scan/quick', { files }).then((r) => r.data)

/**
 * Full deep adversarial scan.
 * @param {Array<{filename: string, content: string}>} files
 * @param {Array} quickFindings  - pass previous quick-scan findings if available
 */
export const deepScan = (files, quickFindings = []) =>
    client.post('/api/v1/scan/deep', { files, quick_findings: quickFindings })
        .then((r) => r.data)

/** Upload raw files for quick scan */
export const uploadScan = (formData) =>
    client.post('/api/v1/scan/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)

export const getHealth = () =>
    client.get('/health').then((r) => r.data)
