export type JobCategory = 'HEOR' | 'RWE / Epidemiology' | 'Market Access' | 'Patient-Centered' | 'Other'
export type OpportunityType = 'Internship' | 'Full-time job' | 'Any'
export type TargetYear = 'Any' | '2026' | '2027' | '2028' | '2029'
export type Season = 'Any' | 'Summer' | 'Fall' | 'Spring'
export type DegreeLevel = 'Any' | 'PhD / Doctoral' | 'Graduate' | 'Master\'s' | 'Bachelor\'s'
export type WorkArrangement = 'Any' | 'Remote' | 'Hybrid' | 'On-site'
export type SearchSource = 'Google Jobs' | 'LinkedIn'

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
}
