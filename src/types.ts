export type JobCategory = 'HEOR' | 'RWE / Epidemiology' | 'Market Access' | 'Patient-Centered' | 'Other'

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
  degreeSignal: string
  sourceQuery: string
  highlights: string[]
}

export interface SearchMeta {
  searchedAt: string
  cutoffDays: number
  queriesRun: number
  rawCount: number
  strictCount: number
  excludedOld: number
  excludedUnknownDate: number
  excludedClosed: number
  excludedIrrelevant: number
}

export interface SearchResponse {
  jobs: Job[]
  meta: SearchMeta
}

export interface SearchProfile {
  cutoffDays: 30
  country: 'United States'
  season: 'Summer 2027'
  degree: 'PhD / Doctoral / Graduate'
  includeRemote: boolean
  categories: JobCategory[]
}
