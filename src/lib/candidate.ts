import type { CandidateProfile } from '../types'

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  expectedGraduation: '2029-08',
  currentStatus: 'PhD student in the United States; internship work authorization expected via CPT',
  cptEligible: true,
  needsFutureSponsorship: true,
  openToRelocation: true,
  notes: 'Seeking HEOR/RWE and related opportunities. Evaluate internship authorization separately from future sponsorship.',
}

export function loadCandidateProfile(): CandidateProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-candidate-profile') || 'null')
    return parsed ? { ...DEFAULT_CANDIDATE_PROFILE, ...parsed } : DEFAULT_CANDIDATE_PROFILE
  } catch {
    return DEFAULT_CANDIDATE_PROFILE
  }
}
