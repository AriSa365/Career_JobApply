import { Bookmark, BookmarkCheck, Building2, CalendarDays, ExternalLink, FilePenLine, Linkedin, Loader2, MapPin, ShieldAlert, Sparkles } from 'lucide-react'
import type { CvMatch, GptAnalysis, Job } from '../types'
import GptAnalysisPanel from './GptAnalysisPanel'

function ageClass(days: number) {
  if (days <= 3) return 'fresh'
  if (days <= 7) return 'recent'
  return 'standard'
}

export default function JobCard({
  job,
  saved,
  onToggleSave,
  cvMatch,
  gptAnalysis,
  analyzing,
  canAnalyze,
  onAnalyze,
  onTailor,
}: {
  job: Job
  saved: boolean
  onToggleSave: () => void
  cvMatch?: CvMatch
  gptAnalysis?: GptAnalysis
  analyzing?: boolean
  canAnalyze?: boolean
  onAnalyze?: () => void
  onTailor?: () => void
}) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div>
          <div className="job-badges">
            <span className={`age-badge ${ageClass(job.daysOld)}`}>{job.daysOld === 0 ? 'Today' : `${job.daysOld}d ago`}</span>
            <span className="category-badge">{job.category}</span>
            <span className={`source-badge ${job.source === 'LinkedIn' ? 'linkedin' : ''}`}>{job.source === 'LinkedIn' && <Linkedin size={10} />}{job.source}</span>
            {job.isRemote && <span className="soft-badge">Remote</span>}
            {job.isHybrid && <span className="soft-badge">Hybrid</span>}
            {job.isOnsite && <span className="soft-badge">On-site</span>}
            {job.needsVerification && <span className="verify-badge"><ShieldAlert size={10} /> Verify details</span>}
            {gptAnalysis && <span className={`gpt-result-badge ${gptAnalysis.recommendation.toLowerCase()}`}><Sparkles size={10} /> {gptAnalysis.recommendation}</span>}
          </div>
          <h3>{job.title}</h3>
          <div className="company-row"><Building2 size={15} /> {job.company}</div>
        </div>

        <div className="score-stack">
          {gptAnalysis ? (
            <div className={`score-ring cv-score gpt-score ${gptAnalysis.recommendation.toLowerCase()}`} title="GPT semantic CV match after eligibility reasoning.">
              <strong>{gptAnalysis.cvMatch}%</strong><span>GPT match</span>
            </div>
          ) : cvMatch ? (
            <div className={`score-ring cv-score ${cvMatch.confidence === 'Preliminary' ? 'preliminary' : ''}`} title="Transparent keyword job–CV alignment score. This is not an employer ATS score.">
              <strong>{cvMatch.score}%</strong><span>CV match</span>
            </div>
          ) : (
            <div className="score-ring" title="Deterministic discovery relevance score; upload a CV for job–CV matching."><strong>{job.matchScore}</strong><span>discovery</span></div>
          )}
          {!gptAnalysis && cvMatch && <small>{cvMatch.confidence}</small>}
        </div>
      </div>

      <div className="job-meta">
        <span><MapPin size={15} /> {job.location || 'Location not provided'}</span>
        <span><CalendarDays size={15} /> {job.postedAtLabel}</span>
      </div>

      <p className="job-description">{job.description || 'Description was not available in the search result. Open the posting to verify details.'}</p>

      <div className="signal-row">
        <span className="signal-label">Degree signal</span>
        <span>{job.degreeSignal}</span>
      </div>

      {!gptAnalysis && cvMatch && (
        <div className="cv-match-details">
          <div>
            <span className="match-detail-label">Matched from your CV</span>
            <div className="keyword-row good">
              {cvMatch.matchedKeywords.length ? cvMatch.matchedKeywords.map((item) => <span key={item}>{item}</span>) : <em>No explicit keyword overlap visible in this search snippet.</em>}
            </div>
          </div>
          {cvMatch.missingKeywords.length > 0 && (
            <div>
              <span className="match-detail-label">Potential gaps to review</span>
              <div className="keyword-row gap">{cvMatch.missingKeywords.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          )}
        </div>
      )}

      {gptAnalysis && <GptAnalysisPanel analysis={gptAnalysis} />}

      {!gptAnalysis && job.needsVerification && (
        <div className="verification-note">Public search snippets can omit degree, work-mode, sponsorship, or employment details. Use GPT Analysis to research the fuller posting before treating this as eligible.</div>
      )}

      {!cvMatch && !gptAnalysis && job.highlights.length > 0 && (
        <div className="keyword-row">
          {job.highlights.slice(0, 6).map((item) => <span key={item}>{item}</span>)}
        </div>
      )}

      <div className="job-footer">
        <div className="source-copy">Found via {job.via} · recency filter passed{cvMatch ? ` · discovery score ${job.matchScore}` : ''}</div>
        <div className="job-actions">
          {onAnalyze && (
            <button className="analyze-btn" onClick={onAnalyze} disabled={!canAnalyze || analyzing} title={!canAnalyze ? 'Upload a CV before GPT analysis' : 'Analyze the full role against your CV'}>
              {analyzing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} {analyzing ? 'Analyzing…' : gptAnalysis ? 'Re-analyze' : 'Analyze with GPT'}
            </button>
          )}
          {gptAnalysis && onTailor && (
            <button className="tailor-btn" onClick={onTailor} title="Create a separate fact-locked job-specific CV"><FilePenLine size={15} /> Tailor CV</button>
          )}
          <button className="icon-btn" onClick={onToggleSave} title={saved ? 'Remove saved job' : 'Save job'}>
            {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
          <a className="apply-btn" href={job.applyUrl} target="_blank" rel="noreferrer">{job.source === 'LinkedIn' ? 'Open LinkedIn' : 'Open application'} <ExternalLink size={15} /></a>
        </div>
      </div>
    </article>
  )
}
