import { FileCheck2, FileText, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { extractCv } from '../lib/cv'
import type { CvProfile } from '../types'

export default function CVPanel({ cv, onChange }: { cv: CvProfile | null; onChange: (cv: CvProfile | null) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file?: File) {
    if (!file) return
    setWorking(true)
    setError('')
    try {
      onChange(await extractCv(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this CV.')
    } finally {
      setWorking(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="cv-panel">
      <div className="cv-panel-title">
        <div className="cv-icon"><FileText size={18} /></div>
        <div>
          <strong>CV match workspace</strong>
          <span>Upload a CV to calculate a job-specific match percentage for every search result.</span>
        </div>
      </div>

      {cv ? (
        <div className="cv-loaded">
          <div className="cv-file-main">
            <FileCheck2 size={20} />
            <div><strong>{cv.fileName}</strong><span>{cv.wordCount.toLocaleString()} words extracted · ready for matching</span></div>
          </div>
          <div className="cv-actions">
            <button className="secondary-btn" onClick={() => inputRef.current?.click()}><Upload size={14} /> Replace CV</button>
            <button className="danger-quiet-btn" onClick={() => onChange(null)}><Trash2 size={14} /> Clear</button>
          </div>
        </div>
      ) : (
        <button className="cv-upload-zone" onClick={() => inputRef.current?.click()} disabled={working}>
          <Upload size={20} />
          <div><strong>{working ? 'Reading CV…' : 'Upload CV'}</strong><span>DOCX, PDF or TXT · parsed locally in this browser</span></div>
        </button>
      )}

      <input ref={inputRef} className="hidden-file-input" type="file" accept=".docx,.pdf,.txt" onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && <div className="inline-error">{error}</div>}
      <div className="cv-privacy-note"><ShieldCheck size={13} /> Raw CV files are not sent to SerpApi or uploaded to Supabase in this phase. Match % is a transparent job–CV alignment score, not an employer ATS score.</div>
    </section>
  )
}
