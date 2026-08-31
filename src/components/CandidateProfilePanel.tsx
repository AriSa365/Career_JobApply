import { GraduationCap, ShieldCheck } from 'lucide-react'
import type { CandidateProfile } from '../types'

export default function CandidateProfilePanel({
  value,
  onChange,
}: {
  value: CandidateProfile
  onChange: (value: CandidateProfile) => void
}) {
  const patch = <K extends keyof CandidateProfile>(key: K, next: CandidateProfile[K]) => onChange({ ...value, [key]: next })

  return (
    <section className="candidate-panel">
      <div className="panel-heading-row">
        <div className="panel-heading-icon"><GraduationCap size={18} /></div>
        <div><strong>Candidate eligibility profile</strong><span>GPT uses these facts when deciding APPLY / REVIEW / SKIP.</span></div>
      </div>

      <div className="candidate-grid">
        <label><span>Expected graduation</span><input type="month" value={value.expectedGraduation} onChange={(e) => patch('expectedGraduation', e.target.value)} /></label>
        <label><span>Current status</span><input value={value.currentStatus} onChange={(e) => patch('currentStatus', e.target.value)} /></label>
        <label className="toggle-row"><input type="checkbox" checked={value.cptEligible} onChange={(e) => patch('cptEligible', e.target.checked)} /><span><b>CPT eligible</b><small>Use as an internship-authorization fact, not a promise of employer sponsorship.</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={value.needsFutureSponsorship} onChange={(e) => patch('needsFutureSponsorship', e.target.checked)} /><span><b>Needs future sponsorship</b><small>Roles explicitly prohibiting future sponsorship should be flagged.</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={value.openToRelocation} onChange={(e) => patch('openToRelocation', e.target.checked)} /><span><b>Open to relocation</b><small>Used when location restrictions appear in the posting.</small></span></label>
        <label className="candidate-notes"><span>Additional notes <em>optional</em></span><textarea rows={3} value={value.notes} onChange={(e) => patch('notes', e.target.value)} /></label>
      </div>

      <div className="privacy-note"><ShieldCheck size={14} /> These settings stay in your browser and are sent only to the protected GPT analysis function when you click Analyze.</div>
    </section>
  )
}
