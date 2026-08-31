import { Bookmark, BookmarkCheck, Building2, CalendarDays, ExternalLink, Linkedin, MapPin, ShieldAlert } from 'lucide-react'
import type { CvMatch, Job } from '../types'

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
}: {
  job: Job
  saved: boolean
  onToggleSave: () => void
  cvMatch?: CvMatch
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
          </div>
          <h3>{job.title}</h3>
          <div className="company-row"><Building2 size={15} /> {job.company}</div>
        </div>

        <div className="score-stack">
          {cvMatch ? (
            <div className={`score-ring cv-score ${cvMatch.confidence === 'Preliminary' ? 'preliminary' : ''}`} title="Transparent job–CV alignment score. This is not an employer ATS score.">
              <strong>{cvMatch.score}%</strong><span>CV match</span>
            </div>
          ) : (
            <div className="score-ring" title="Deterministic discovery relevance score; upload a CV for job–CV matching."><strong>{job.matchScore}</strong><span>discovery</span></div>
          )}
          {cvMatch && <small>{cvMatch.confidence}</small>}
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

      {cvMatch && (
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

      {job.needsVerification && (
        <div className="verification-note">LinkedIn public search snippets can omit degree, work-mode, or employment details. Open the posting before treating this as fully eligible.</div>
      )}

      {!cvMatch && job.highlights.length > 0 && (
        <div className="keyword-row">
          {job.highlights.slice(0, 6).map((item) => <span key={item}>{item}</span>)}
        </div>
      )}

      <div className="job-footer">
        <div className="source-copy">Found via {job.via} · recency filter passed{cvMatch ? ` · discovery score ${job.matchScore}` : ''}</div>
        <div className="job-actions">
          <button className="icon-btn" onClick={onToggleSave} title={saved ? 'Remove saved job' : 'Save job'}>
            {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
          <a className="apply-btn" href={job.applyUrl} target="_blank" rel="noreferrer">{job.source === 'LinkedIn' ? 'Open LinkedIn' : 'Open application'} <ExternalLink size={15} /></a>
        </div>
      </div>
    </article>
  )
}
