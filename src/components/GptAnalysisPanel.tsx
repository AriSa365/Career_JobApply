import { AlertTriangle, CheckCircle2, ExternalLink, Sparkles, XCircle } from 'lucide-react'
import type { GptAnalysis } from '../types'

function statusClass(value: string) {
  if (['APPLY', 'PASS', 'COMPATIBLE', 'HIGH'].includes(value)) return 'positive'
  if (['SKIP', 'FAIL', 'INCOMPATIBLE', 'LOW'].includes(value)) return 'negative'
  return 'review'
}

function StatusIcon({ value }: { value: string }) {
  if (['APPLY', 'PASS', 'COMPATIBLE'].includes(value)) return <CheckCircle2 size={14} />
  if (['SKIP', 'FAIL', 'INCOMPATIBLE'].includes(value)) return <XCircle size={14} />
  return <AlertTriangle size={14} />
}

export default function GptAnalysisPanel({ analysis }: { analysis: GptAnalysis }) {
  return (
    <div className="gpt-analysis-panel">
      <div className="gpt-analysis-header">
        <div><span className="gpt-kicker"><Sparkles size={13} /> GPT analysis</span><strong>{analysis.summary}</strong></div>
        <div className={`recommendation-pill ${statusClass(analysis.recommendation)}`}><StatusIcon value={analysis.recommendation} /> {analysis.recommendation}</div>
      </div>

      <div className="analysis-score-grid">
        <div><span>Semantic CV match</span><strong>{analysis.cvMatch}%</strong></div>
        <div><span>Overall fit</span><strong>{analysis.overallFit}%</strong></div>
        <div><span>Eligibility</span><strong className={statusClass(analysis.eligibility)}>{analysis.eligibility}</strong></div>
        <div><span>Sponsorship</span><strong className={statusClass(analysis.sponsorship)}>{analysis.sponsorship}</strong></div>
        <div><span>HEOR relevance</span><strong className={statusClass(analysis.heorRelevance)}>{analysis.heorRelevance}</strong></div>
        <div><span>JD evidence</span><strong>{analysis.jobDescriptionCompleteness}</strong></div>
      </div>

      <div className="analysis-reasons">
        <div><b>Eligibility:</b> {analysis.eligibilityReason}</div>
        <div><b>Sponsorship:</b> {analysis.sponsorshipReason}</div>
      </div>

      <div className="analysis-columns">
        <div><span className="analysis-section-label">Strong matches</span><ul>{analysis.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><span className="analysis-section-label">Gaps / weaknesses</span><ul>{analysis.gaps.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><span className="analysis-section-label">CV tailoring actions</span><ul>{analysis.tailoringActions.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>

      {analysis.cautionFlags.length > 0 && <div className="analysis-cautions"><b>Flags:</b> {analysis.cautionFlags.join(' · ')}</div>}

      {analysis.atsKeywords.length > 0 && <div className="analysis-keywords"><span>Important JD terms</span><div className="keyword-row">{analysis.atsKeywords.slice(0, 12).map((x) => <span key={x}>{x}</span>)}</div></div>}

      <div className="analysis-footer">
        <span>{analysis.model} · {analysis.reasoningDepth} reasoning · analyzed {new Date(analysis.analyzedAt).toLocaleString()}</span>
        {analysis.sourceUrls.length > 0 && <div className="source-links">{analysis.sourceUrls.slice(0, 3).map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer">Source {i + 1} <ExternalLink size={12} /></a>)}</div>}
      </div>
    </div>
  )
}
