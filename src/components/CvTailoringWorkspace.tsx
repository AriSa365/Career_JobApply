import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Clipboard, Download, FileCheck2, FilePenLine, Loader2, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { downloadTailoredCvDocx, downloadTailoringAudit, tailoredCvToPlainText } from '../lib/docx'
import type { CvProfile, CvTailoringEmphasis, CvTailoringFormat, CvTailoringSettings, GptAnalysis, Job, TailoredCvDocument } from '../types'

const FORMATS: CvTailoringFormat[] = ['Industry CV · 2 pages', 'Academic CV · full', 'Concise resume · 1 page']
const EMPHASES: CvTailoringEmphasis[] = ['Balanced', 'HEOR / research', 'Quantitative / technical']

function RecommendationBadge({ analysis }: { analysis: GptAnalysis }) {
  return <span className={`tailor-recommendation ${analysis.recommendation.toLowerCase()}`}>{analysis.recommendation} · {analysis.cvMatch}% GPT match</span>
}

export default function CvTailoringWorkspace({
  cv,
  jobs,
  analyses,
  tailoredCvs,
  selectedJobId,
  onSelectJobId,
  settings,
  onSettingsChange,
  generatingIds,
  onGenerate,
  onDocumentChange,
  trackedJobIds,
  onTrackJob,
}: {
  cv: CvProfile | null
  jobs: Job[]
  analyses: Map<string, GptAnalysis>
  tailoredCvs: Map<string, TailoredCvDocument>
  selectedJobId: string
  onSelectJobId: (value: string) => void
  settings: CvTailoringSettings
  onSettingsChange: (value: CvTailoringSettings) => void
  generatingIds: string[]
  onGenerate: (job: Job) => void
  onDocumentChange: (jobId: string, document: TailoredCvDocument) => void
  trackedJobIds: string[]
  onTrackJob: (job: Job) => void
}) {
  const [copied, setCopied] = useState(false)
  const analyzedJobs = useMemo(() => jobs.filter((job) => analyses.has(job.id)), [jobs, analyses])
  const selectedJob = analyzedJobs.find((job) => job.id === selectedJobId) || analyzedJobs[0]
  const analysis = selectedJob ? analyses.get(selectedJob.id) : undefined
  const document = selectedJob ? tailoredCvs.get(selectedJob.id) : undefined
  const generating = selectedJob ? generatingIds.includes(selectedJob.id) : false

  function editBullet(sectionId: string, blockId: string, bulletId: string, text: string) {
    if (!selectedJob || !document) return
    const next: TailoredCvDocument = {
      ...document,
      manuallyEdited: true,
      sections: document.sections.map((section) => section.id !== sectionId ? section : {
        ...section,
        blocks: section.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          bullets: block.bullets.map((bullet) => bullet.id === bulletId ? { ...bullet, text } : bullet),
        }),
      }),
    }
    onDocumentChange(selectedJob.id, next)
  }

  async function copyDocument() {
    if (!document || !cv) return
    await navigator.clipboard.writeText(tailoredCvToPlainText(document, cv))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <>
      <header className="topbar analysis-topbar">
        <div>
          <p className="eyebrow">GPT-5.6 SOL · PHASE 3</p>
          <h1>Fact-locked CV tailoring studio</h1>
          <p>Generate a separate job-specific CV, preserve your master CV, and audit every rewritten claim against source evidence.</p>
        </div>
      </header>

      <section className="tailor-control-card">
        <div className="panel-heading-row">
          <div className="panel-heading-icon"><FilePenLine size={18} /></div>
          <div><strong>Choose an analyzed role</strong><span>Phase 3 requires a Phase 2 GPT analysis so eligibility and gaps are already understood.</span></div>
        </div>

        {analyzedJobs.length === 0 ? (
          <div className="inline-warning phase2-warning"><AlertTriangle size={15} /> Analyze at least one role with GPT before tailoring a CV.</div>
        ) : (
          <div className="tailor-controls-grid">
            <label className="tailor-job-select"><span>Analyzed job</span><select value={selectedJob?.id || ''} onChange={(e) => onSelectJobId(e.target.value)}>{analyzedJobs.map((job) => <option key={job.id} value={job.id}>{job.company} — {job.title}</option>)}</select></label>
            <label><span>Document format</span><select value={settings.format} onChange={(e) => onSettingsChange({ ...settings, format: e.target.value as CvTailoringFormat })}>{FORMATS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label><span>Emphasis</span><select value={settings.emphasis} onChange={(e) => onSettingsChange({ ...settings, emphasis: e.target.value as CvTailoringEmphasis })}>{EMPHASES.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
        )}

        {selectedJob && analysis && (
          <div className="tailor-job-summary">
            <div><strong>{selectedJob.title}</strong><span>{selectedJob.company} · {selectedJob.location}</span></div>
            <RecommendationBadge analysis={analysis} />
            <div className="tailor-mini-facts"><span>Eligibility <b>{analysis.eligibility}</b></span><span>Sponsorship <b>{analysis.sponsorship}</b></span><span>HEOR relevance <b>{analysis.heorRelevance}</b></span></div>
          </div>
        )}

        {!cv && <div className="inline-warning phase2-warning"><AlertTriangle size={15} /> Upload your master CV in Job Discovery before generating a tailored version.</div>}
        {selectedJob && analysis?.recommendation === 'SKIP' && <div className="tailor-skip-warning"><AlertTriangle size={15} /> This role was classified SKIP. Tailoring is still available for review, but a better-fitting eligible role is usually a better use of API cost.</div>}

        <div className="tailor-generate-row">
          <button className="primary-btn" disabled={!selectedJob || !analysis || !cv || generating} onClick={() => selectedJob && onGenerate(selectedJob)}>{generating ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} {generating ? 'Building fact-locked CV…' : document ? 'Regenerate tailored CV' : 'Generate tailored CV'}</button>
          <span>The master CV remains unchanged. Generated versions are stored separately.</span>
        </div>
      </section>

      {!document ? (
        <section className="empty-state phase3-empty"><div className="empty-icon"><FilePenLine size={25} /></div><h2>No tailored CV generated for this role</h2><p>Generate one after reviewing the Phase 2 analysis. Unsupported requirements remain gaps instead of being added to your CV.</p></section>
      ) : (
        <>
          <section className="phase3-metrics">
            <div><span>Projected alignment</span><strong>{document.projectedAlignment}%</strong><small>Job–CV alignment, not employer ATS</small></div>
            <div><span>Fact lock</span><strong className={document.factLock.passed ? 'positive' : 'review'}>{document.factLock.passed ? 'PASSED' : 'REVIEW'}</strong><small>{document.factLock.verifiedClaims} evidence-linked claims</small></div>
            <div><span>Retained gaps</span><strong>{document.retainedGaps.length}</strong><small>Not fabricated into the CV</small></div>
            <div><span>Manual edits</span><strong>{document.manuallyEdited ? 'YES' : 'NO'}</strong><small>{document.manuallyEdited ? 'Re-review edits before submitting' : 'GPT draft unchanged'}</small></div>
          </section>

          <section className="tailored-cv-layout">
            <div className="tailored-cv-preview-card">
              <div className="tailored-preview-toolbar"><div><strong>Editable tailored CV</strong><span>Click into a bullet to make final edits.</span></div><div className="tailored-actions"><button onClick={copyDocument}><Clipboard size={14} /> {copied ? 'Copied' : 'Copy text'}</button><button onClick={() => selectedJob && downloadTailoringAudit(document, selectedJob)}><FileCheck2 size={14} /> Audit JSON</button><button className="download-docx-btn" onClick={() => selectedJob && cv && downloadTailoredCvDocx(document, cv, selectedJob)}><Download size={14} /> Download DOCX</button>{selectedJob && <button className="application-track-btn" onClick={() => onTrackJob(selectedJob)}>{trackedJobIds.includes(selectedJob.id) ? <Check size={14} /> : <Send size={14} />} {trackedJobIds.includes(selectedJob.id) ? 'Tracked' : 'Add to Applications'}</button>}</div></div>

              <div className="cv-paper">
                {cv && <div className="cv-paper-header"><strong>{cv.text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)[0] || 'Candidate'}</strong><span>{cv.text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)[1] || ''}</span></div>}
                {document.sections.map((section) => (
                  <section key={section.id} className="cv-preview-section">
                    <h3>{section.title}</h3>
                    {section.blocks.map((block) => (
                      <div key={block.id} className="cv-preview-block">
                        {block.heading && <strong>{block.heading}</strong>}
                        {(block.subheading || block.meta) && <div className="cv-preview-meta">{[block.subheading, block.meta].filter(Boolean).join(' | ')}</div>}
                        <ul>{block.bullets.map((bullet) => <li key={bullet.id}><textarea value={bullet.text} rows={Math.max(2, Math.ceil(bullet.text.length / 92))} onChange={(e) => editBullet(section.id, block.id, bullet.id, e.target.value)} /></li>)}</ul>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>

            <aside className="tailoring-audit-card">
              <div className="audit-heading"><ShieldCheck size={18} /><div><strong>Fact-lock audit</strong><span>Evidence is checked against your uploaded master CV.</span></div></div>
              {document.factLock.rejectedClaims.length > 0 && <div className="rejected-claims"><b>Rejected claims</b>{document.factLock.rejectedClaims.map((x) => <span key={x}>{x}</span>)}</div>}
              <div className="audit-list"><b>Targeted keywords</b>{document.targetedKeywords.length ? document.targetedKeywords.map((x) => <span key={x}>{x}</span>) : <em>None returned.</em>}</div>
              <div className="audit-list gaps"><b>Do not add / retained gaps</b>{document.retainedGaps.length ? document.retainedGaps.map((x) => <span key={x}>{x}</span>) : <em>No explicit unresolved gaps.</em>}</div>
              <div className="audit-list"><b>What changed</b>{document.changeSummary.map((x) => <span key={x}>{x}</span>)}</div>
              {document.omittedContent.length > 0 && <div className="audit-list muted"><b>De-emphasized / omitted</b>{document.omittedContent.map((x) => <span key={`${x.item}-${x.reason}`}>{x.item} — {x.reason}</span>)}</div>}
              {document.warnings.length > 0 && <div className="tailor-warning-list"><b>Review before submission</b>{document.warnings.map((x) => <span key={x}>{x}</span>)}</div>}
              {document.manuallyEdited && <div className="manual-edit-note"><AlertTriangle size={14} /> Fact lock applies to the original generated claims. Your manual edits should be reviewed before final submission.</div>}
            </aside>
          </section>
        </>
      )}
    </>
  )
}
