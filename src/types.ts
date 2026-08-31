export type JobCategory = 'HEOR' | 'RWE / Epidemiology' | 'Market Access' | 'Patient-Centered' | 'Other'
export type OpportunityType = 'Internship' | 'Full-time job' | 'Any'
export type TargetYear = string
export type Season = 'Any' | 'Summer' | 'Fall' | 'Winter' | 'Spring'
export type DegreeLevel = 'Any' | 'PhD / Doctoral' | 'Graduate' | 'Master\'s' | 'Bachelor\'s'
export type WorkArrangement = 'Any' | 'Remote' | 'Hybrid' | 'On-site'
export type SearchSource = 'Google Jobs' | 'LinkedIn'
export type Recommendation = 'APPLY' | 'REVIEW' | 'SKIP'
export type EligibilityStatus = 'PASS' | 'REVIEW' | 'FAIL'
export type SponsorshipStatus = 'COMPATIBLE' | 'UNKNOWN' | 'INCOMPATIBLE'
export type DetailCompleteness = 'FULL' | 'PARTIAL' | 'SNIPPET'
export type AnalysisDepth = 'Standard' | 'Deep'

export interface ApplyOption {
  title: string
  link: string
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  via: string
  source: SearchSource
  description: string
  postedAtLabel: string
  postedAtISO: string
  daysOld: number
  applyUrl: string
  applyOptions: ApplyOption[]
  category: JobCategory
  matchScore: number
  isRemote: boolean
  isHybrid: boolean
  isOnsite: boolean
  opportunityType: OpportunityType
  degreeSignal: string
  sourceQuery: string
  highlights: string[]
  needsVerification: boolean
}

export interface SearchMeta {
  searchedAt: string
  cutoffDays: number
  queriesRun: number
  queriesSucceeded: number
  zeroResultQueries: number
  queryWarnings: string[]
  rawCount: number
  strictCount: number
  excludedOld: number
  excludedUnknownDate: number
  excludedClosed: number
  excludedIrrelevant: number
  sourceCounts: Partial<Record<SearchSource, number>>
}

export interface SearchResponse {
  jobs: Job[]
  meta: SearchMeta
}

export interface SearchProfile {
  cutoffDays: number
  opportunityType: OpportunityType
  targetYear: TargetYear
  season: Season
  degree: DegreeLevel
  workArrangement: WorkArrangement
  country: string
  locationQuery: string
  sources: SearchSource[]
  categories: JobCategory[]
  customKeywords: string[]
}

export interface CvProfile {
  fileName: string
  text: string
  uploadedAt: string
  wordCount: number
}

export interface CvMatch {
  score: number
  confidence: 'Strong' | 'Preliminary'
  matchedKeywords: string[]
  missingKeywords: string[]
  evidenceCount: number
}

export interface CandidateProfile {
  expectedGraduation: string
  currentStatus: string
  cptEligible: boolean
  needsFutureSponsorship: boolean
  openToRelocation: boolean
  notes: string
}

export interface GptAnalysis {
  jobId: string
  analyzedAt: string
  model: string
  reasoningDepth: AnalysisDepth
  recommendation: Recommendation
  eligibility: EligibilityStatus
  eligibilityReason: string
  sponsorship: SponsorshipStatus
  sponsorshipReason: string
  cvMatch: number
  overallFit: number
  heorRelevance: 'HIGH' | 'MEDIUM' | 'LOW'
  jobDescriptionCompleteness: DetailCompleteness
  summary: string
  requiredQualifications: string[]
  preferredQualifications: string[]
  strengths: string[]
  gaps: string[]
  atsKeywords: string[]
  tailoringActions: string[]
  cautionFlags: string[]
  sourceUrls: string[]
  evidenceNotes: string[]
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

export interface AnalyzeJobRequest {
  job: Job
  cv: CvProfile
  candidate: CandidateProfile
  depth: AnalysisDepth
}

export interface AnalyzeJobResponse {
  analysis: GptAnalysis
}
