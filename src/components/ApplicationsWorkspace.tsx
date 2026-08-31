import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { applicationPackageToPlainText, downloadCoverLetterDocx } from '../lib/application-docx'
import { downloadTailoredCvDocx } from '../lib/docx'
import type {
  ApplicationPackage,
  ApplicationRecord,
  ApplicationStatus,
  CvProfile,
  GptAnalysis,
  Job,
  TailoredCvDocument,
} from '../types'

const STATUSES: ApplicationStatus[] = ['Ready to apply', 'Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn']

function statusClass(status: ApplicationStatus) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function ApplicationsWorkspace({
  jobs,
  analyses,
  tailoredCvs,
  cv,
  applications,
  packages,
  selectedApplicationId,
  generatingIds,
  onSelectApplicationId,
  onTrackJob,
  onUpdateApplication,
  onRemoveApplication,
  onGeneratePackage,
  onPackageChange,
}: {
  jobs: Job[]
  analyses: Map<string, GptAnalysis>
  tailoredCvs: Map<string, TailoredCvDocument>
  cv: CvProfile | null
  applications: Map<string, ApplicationRecord>
  packages: Map<string, ApplicationPackage>
  selectedApplicationId: string
  generatingIds: string[]
  onSelectApplicationId: (id: string) => void
  onTrackJob: (job: Job) => void
  onUpdateApplication: (application: ApplicationRecord) => void
  onRemoveApplication: (id: string) => void
  onGeneratePackage: (application: ApplicationRecord, customQuestions: Array<{ question: string; maxChars: number | null }>) => void
  onPackageChange: (jobId: string, pkg: ApplicationPackage) => void
}) {
  const [questionDraft, setQuestionDraft] = useState('')
  const [charLimitDraft, setCharLimitDraft] = useState('')
  const [customQuestions, setCustomQuestions] = useState<Array<{ question: string; maxChars: number | null }>>([])
  const [copied, setCopied] = useState('')

  const applicationList = useMemo(() => Array.from(applications.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [applications])
  const selected = applications.get(selectedApplicationId) || applicationList[0]
  const pkg = selected ? packages.get(selected.jobId) : undefined
  const analysis = selected ? analyses.get(selected.jobId) : undefined
  const tailoredCv = selected ? tailoredCvs.get(selected.jobId) : undefined
  const generating = selected ? generatingIds.includes(selected.jobId) : false

  const readyUntracked = jobs.filter((job) => tailoredCvs.has(job.id) && !Array.from(applications.values()).some((app) => app.jobId === job.id))
  const appliedCount = applicationList.filter((x) => ['Applied', 'Interview', 'Offer'].includes(x.status)).length
  const interviewCount = applicationList.filter((x) => x.status === 'Interview').length
  const offerCount = applicationList.filter((x) => x.status === 'Offer').length

  function update(patch: Partial<ApplicationRecord>) {
    if (!selected) return
    onUpdateApplication({ ...selected, ...patch, updatedAt: new Date().toISOString() })
  }

  function markSubmitted() {
    if (!selected) return
    onUpdateApplication({
      ...selected,
      status: 'Applied',
      appliedAt: selected.appliedAt || todayIso(),
      followUpAt: selected.followUpAt || addDaysIso(7),
      updatedAt: new Date().toISOString(),
    })
  }

  function addQuestion() {
    const question = questionDraft.trim()
    if (!question) return
    const parsed = Number(charLimitDraft)
    setCustomQuestions((current) => [...current, { question, maxChars: Number.isFinite(parsed) && parsed > 0 ? parsed : null }])
    setQuestionDraft('')
    setCharLimitDraft('')
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(''), 1500)
  }

  function editCoverParagraph(id: string, text: string) {
    if (!selected || !pkg) return
    onPackageChange(selected.jobId, {
      ...pkg,
      coverLetter: { ...pkg.coverLetter, paragraphs: pkg.coverLetter.paragraphs.map((p) => p.id === id ? { ...p, text } : p) },
    })
  }

  function editAnswer(id: string, answer: string) {
    if (!selected || !pkg) return
    onPackageChange(selected.jobId, { ...pkg, answers: pkg.answers.map((item) => item.id === id ? { ...item, answer } : item) })
  }

  return (
    <>
      <header className="topbar analysis-topbar">
        <div>
          <p className="eyebrow">GPT-5.6 SOL · PHASE 4</p>
          <h1>Application manager & submission pack</h1>
          <p>Prepare the final application materials, track every status change, and keep the final employer submission under your control.</p>
        </div>
      </header>

      <section className="phase4-summary">
        <div><span>Tracked</span><strong>{applicationList.length}</strong><small>Active application records</small></div>
        <div><span>Applied+</span><strong>{appliedCount}</strong><small>Applied, interview or offer</small></div>
        <div><span>Interviews</span><strong>{interviewCount}</strong><small>Current interview stage</small></div>
        <div><span>Offers</span><strong>{offerCount}</strong><small>Offer stage</small></div>
      </section>

      {readyUntracked.length > 0 && (
        <section className="ready-to-track-card">
          <div className="panel-heading-row"><div className="panel-heading-icon"><Plus size={18} /></div><div><strong>Tailored roles ready to track</strong><span>Add a generated CV role to your application pipeline.</span></div></div>
          <div className="ready-role-list">
            {readyUntracked.map((job) => <button key={job.id} onClick={() => onTrackJob(job)}><BriefcaseBusiness size={14} /><span><b>{job.company}</b>{job.title}</span><Plus size={14} /></button>)}
          </div>
        </section>
      )}

      {applicationList.length === 0 ? (
        <section className="empty-state phase4-empty"><div className="empty-icon"><CheckCircle2 size={25} /></div><h2>No applications tracked yet</h2><p>Generate a tailored CV for an APPLY or REVIEW role, then add it to this workspace. The app will prepare the final package, while you keep control of the final Submit click.</p></section>
      ) : (
        <section className="applications-layout">
          <aside className="application-list-card">
            <div className="application-list-heading"><strong>Application pipeline</strong><span>{applicationList.length} tracked role{applicationList.length === 1 ? '' : 's'}</span></div>
            <div className="application-list-items">
              {applicationList.map((application) => (
                <button key={application.id} className={selected?.id === application.id ? 'selected' : ''} onClick={() => onSelectApplicationId(application.id)}>
                  <span className={`application-status-dot ${statusClass(application.status)}`} />
                  <span className="application-list-copy"><b>{application.job.company}</b><em>{application.job.title}</em><small>{application.status}{application.appliedAt ? ` · ${application.appliedAt}` : ''}</small></span>
                </button>
              ))}
            </div>
          </aside>

          {selected && (
            <div className="application-detail-stack">
              <section className="application-control-card">
                <div className="application-role-head">
                  <div><span className={`application-status-badge ${statusClass(selected.status)}`}>{selected.status}</span><h2>{selected.job.title}</h2><p>{selected.job.company} · {selected.job.location}</p></div>
                  <div className="application-head-actions">{tailoredCv && cv && <button onClick={() => downloadTailoredCvDocx(tailoredCv, cv, selected.job)}><Download size={14} /> Tailored CV</button>}<a href={selected.job.applyUrl} target="_blank" rel="noreferrer">Open application <ExternalLink size={14} /></a><button className="danger-link" onClick={() => onRemoveApplication(selected.id)}><Trash2 size={14} /> Remove</button></div>
                </div>

                <div className="application-form-grid">
                  <label><span>Status</span><select value={selected.status} onChange={(e) => update({ status: e.target.value as ApplicationStatus })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
                  <label><span>Application deadline</span><input type="date" value={selected.deadline} onChange={(e) => update({ deadline: e.target.value })} /></label>
                  <label><span>Applied date</span><input type="date" value={selected.appliedAt} onChange={(e) => update({ appliedAt: e.target.value })} /></label>
                  <label><span>Follow-up date</span><input type="date" value={selected.followUpAt} onChange={(e) => update({ followUpAt: e.target.value })} /></label>
                  <label className="application-notes"><span>Notes</span><textarea rows={3} value={selected.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Recruiter, referral, application ID, interview notes, next action…" /></label>
                </div>

                <div className="application-readiness-row">
                  <span className={analysis ? 'ready' : 'missing'}>{analysis ? <Check size={13} /> : <AlertTriangle size={13} />} GPT analysis</span>
                  <span className={tailoredCv ? 'ready' : 'missing'}>{tailoredCv ? <Check size={13} /> : <AlertTriangle size={13} />} Tailored CV</span>
                  <span className={pkg ? 'ready' : 'missing'}>{pkg ? <Check size={13} /> : <AlertTriangle size={13} />} Application pack</span>
                </div>

                <div className="application-submit-actions">
                  <button className="primary-btn" onClick={() => onGeneratePackage(selected, customQuestions)} disabled={generating || !analysis || !tailoredCv || !cv}>{generating ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} {generating ? 'Preparing application…' : pkg ? 'Regenerate application pack' : 'Generate application pack'}</button>
                  <button className="mark-submitted-btn" onClick={markSubmitted}><Send size={15} /> I submitted this application</button>
                </div>
                {analysis?.recommendation === 'SKIP' && <div className="tailor-skip-warning"><AlertTriangle size={15} /> Phase 2 classified this role SKIP. You can track it, but review eligibility before submitting.</div>}
              </section>

              <section className="custom-question-card">
                <div className="panel-heading-row"><div className="panel-heading-icon"><FileText size={18} /></div><div><strong>Optional application questions</strong><span>Add employer-specific questions before generating the package.</span></div></div>
                <div className="question-builder"><input value={questionDraft} onChange={(e) => setQuestionDraft(e.target.value)} placeholder="e.g., Why are you interested in this internship?" /><input className="char-limit" value={charLimitDraft} onChange={(e) => setCharLimitDraft(e.target.value.replace(/\D/g, ''))} placeholder="Max chars" /><button onClick={addQuestion} disabled={!questionDraft.trim()}><Plus size={14} /> Add</button></div>
                {customQuestions.length > 0 && <div className="custom-question-chips">{customQuestions.map((q, index) => <button key={`${q.question}-${index}`} onClick={() => setCustomQuestions((items) => items.filter((_, i) => i !== index))}>{q.question}{q.maxChars ? ` · ${q.maxChars}` : ''} ×</button>)}</div>}
              </section>

              {pkg && cv && (
                <>
                  <section className="application-package-grid">
                    <div className="cover-letter-card">
                      <div className="package-section-heading"><div><Mail size={17} /><span><strong>Cover letter</strong><small>Editable before download.</small></span></div><div><button onClick={() => copy(pkg.coverLetter.paragraphs.map((p) => p.text).join('\n\n'), 'cover')}>{copied === 'cover' ? <Check size={14} /> : <Clipboard size={14} />} {copied === 'cover' ? 'Copied' : 'Copy'}</button><button className="download-docx-btn" onClick={() => downloadCoverLetterDocx(pkg, cv, selected.job)}><Download size={14} /> DOCX</button></div></div>
                      <div className="cover-letter-paper"><p>{pkg.coverLetter.greeting}</p>{pkg.coverLetter.paragraphs.map((paragraph) => <textarea key={paragraph.id} rows={Math.max(4, Math.ceil(paragraph.text.length / 95))} value={paragraph.text} onChange={(e) => editCoverParagraph(paragraph.id, e.target.value)} />)}<p>{pkg.coverLetter.closing}</p></div>
                    </div>

                    <aside className="application-guidance-card">
                      <div className="audit-heading"><CheckCircle2 size={18} /><div><strong>Submission guidance</strong><span>Human review remains required before final submission.</span></div></div>
                      <div className={`phase4-factlock ${pkg.factLock.passed ? 'passed' : 'review'}`}><b>Fact lock</b><strong>{pkg.factLock.passed ? 'PASSED' : 'REVIEW'}</strong><span>{pkg.factLock.verifiedEvidence} CV evidence excerpts verified</span></div>
                      {pkg.factLock.rejectedItems.length > 0 && <div className="rejected-claims"><b>Rejected items</b>{pkg.factLock.rejectedItems.map((item) => <span key={item}>{item}</span>)}</div>}
                      <div className="authorization-guidance"><b>Work authorization guidance</b><span><strong>Current:</strong> {pkg.authorizationGuidance.currentAuthorization}</span><span><strong>Future sponsorship:</strong> {pkg.authorizationGuidance.futureSponsorship}</span><span><strong>Relocation:</strong> {pkg.authorizationGuidance.relocation}</span>{pkg.authorizationGuidance.cautions.map((caution) => <em key={caution}>{caution}</em>)}</div>
                      <div className="submission-checklist"><b>Before you click Submit</b>{pkg.submissionChecklist.map((item) => <span key={item}><CheckCircle2 size={12} /> {item}</span>)}</div>
                      <button className="copy-package-btn" onClick={() => copy(applicationPackageToPlainText(pkg), 'all')}>{copied === 'all' ? <Check size={14} /> : <Clipboard size={14} />} {copied === 'all' ? 'Copied package' : 'Copy complete package'}</button>
                    </aside>
                  </section>

                  <section className="application-answers-card">
                    <div className="package-section-heading"><div><FileText size={17} /><span><strong>Application answer bank</strong><small>Paste only when the employer asks the corresponding question.</small></span></div></div>
                    <div className="application-answer-list">
                      {pkg.answers.map((answer) => (
                        <div key={answer.id} className="application-answer-item">
                          <div className="answer-question"><strong>{answer.question}</strong>{answer.maxChars ? <span>{answer.answer.length}/{answer.maxChars} chars</span> : null}</div>
                          <textarea rows={Math.max(3, Math.ceil(answer.answer.length / 120))} value={answer.answer} onChange={(e) => editAnswer(answer.id, e.target.value)} />
                          <div className="answer-meta"><span>{answer.sourceEvidence.length} CV evidence excerpt{answer.sourceEvidence.length === 1 ? '' : 's'}</span>{answer.warning && <em><AlertTriangle size={11} /> {answer.warning}</em>}<button onClick={() => copy(answer.answer, answer.id)}>{copied === answer.id ? <Check size={12} /> : <Clipboard size={12} />} {copied === answer.id ? 'Copied' : 'Copy answer'}</button></div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </>
  )
}
