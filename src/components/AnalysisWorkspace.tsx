import { BrainCircuit, Sparkles } from 'lucide-react'
import CandidateProfilePanel from './CandidateProfilePanel'
import JobCard from './JobCard'
import type { AnalysisDepth, CandidateProfile, CvProfile, GptAnalysis, Job } from '../types'

export default function AnalysisWorkspace({
  candidate,
  onCandidateChange,
  depth,
  onDepthChange,
  cv,
  jobs,
  analyses,
  analyzingIds,
  savedIds,
  onAnalyze,
  onToggleSave,
}: {
  candidate: CandidateProfile
  onCandidateChange: (value: CandidateProfile) => void
  depth: AnalysisDepth
  onDepthChange: (value: AnalysisDepth) => void
  cv: CvProfile | null
  jobs: Job[]
  analyses: Map<string, GptAnalysis>
  analyzingIds: string[]
  savedIds: string[]
  onAnalyze: (job: Job) => void
  onToggleSave: (jobId: string) => void
}) {
  const analyzedJobs = jobs.filter((job) => analyses.has(job.id))

  return (
    <>
      <header className="topbar analysis-topbar">
        <div>
          <p className="eyebrow">GPT-5.6 SOL · PHASE 2</p>
          <h1>Job intelligence & eligibility analysis</h1>
          <p>Read the fuller posting, reason about graduation timing and sponsorship, then compare it semantically with your CV.</p>
        </div>
        <div className="model-control"><BrainCircuit size={18} /><label><span>Reasoning depth</span><select value={depth} onChange={(e) => onDepthChange(e.target.value as AnalysisDepth)}><option>Standard</option><option>Deep</option></select></label></div>
      </header>

      <CandidateProfilePanel value={candidate} onChange={onCandidateChange} />

      {!cv && <div className="inline-warning phase2-warning"><Sparkles size={15} /> Upload a CV in Job Discovery before running GPT analysis.</div>}

      <section className="phase2-summary">
        <div><span>Analyzed</span><strong>{analyses.size}</strong></div>
        <div><span>APPLY</span><strong>{Array.from(analyses.values()).filter((x) => x.recommendation === 'APPLY').length}</strong></div>
        <div><span>REVIEW</span><strong>{Array.from(analyses.values()).filter((x) => x.recommendation === 'REVIEW').length}</strong></div>
        <div><span>SKIP</span><strong>{Array.from(analyses.values()).filter((x) => x.recommendation === 'SKIP').length}</strong></div>
      </section>

      {analyzedJobs.length === 0 ? (
        <section className="empty-state phase2-empty"><div className="empty-icon"><Sparkles size={25} /></div><h2>No GPT analyses yet</h2><p>Return to Job Discovery and click <b>Analyze with GPT</b> on a promising role. Analysis is intentionally manual so you control API usage.</p></section>
      ) : (
        <section className="jobs-list">
          <div className="results-heading"><div><h2>{analyzedJobs.length} analyzed role{analyzedJobs.length === 1 ? '' : 's'}</h2><p>Saved locally in this browser and persisted server-side without your raw CV.</p></div></div>
          {analyzedJobs.map((job) => <JobCard key={job.id} job={job} saved={savedIds.includes(job.id)} onToggleSave={() => onToggleSave(job.id)} gptAnalysis={analyses.get(job.id)} analyzing={analyzingIds.includes(job.id)} canAnalyze={Boolean(cv)} onAnalyze={() => onAnalyze(job)} />)}
        </section>
      )}
    </>
  )
}
