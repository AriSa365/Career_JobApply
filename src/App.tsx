import { useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError, type Session } from '@supabase/supabase-js'
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Filter,
  FilePenLine,
  Linkedin,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wifi,
  UsersRound,
  X,
} from 'lucide-react'
import AnalysisWorkspace from './components/AnalysisWorkspace'
import ApplicationsWorkspace from './components/ApplicationsWorkspace'
import ConfigMissing from './components/ConfigMissing'
import CVPanel from './components/CVPanel'
import CvTailoringWorkspace from './components/CvTailoringWorkspace'
import JobCard from './components/JobCard'
import Login from './components/Login'
import NetworkingWorkspace from './components/NetworkingWorkspace'
import StatCard from './components/StatCard'
import { DEFAULT_CANDIDATE_PROFILE, loadCandidateProfile } from './lib/candidate'
import { calculateCvMatch } from './lib/cv'
import { isConfigured, supabase } from './lib/supabase'
import type {
  AnalysisDepth,
  AnalyzeJobResponse,
  ApplicationPackage,
  ApplicationRecord,
  CandidateProfile,
  CvTailoringSettings,
  CvProfile,
  DegreeLevel,
  GptAnalysis,
  Job,
  JobCategory,
  OpportunityType,
  SearchMeta,
  SearchProfile,
  SearchResponse,
  SearchSource,
  Season,
  PrepareApplicationResponse,
  TailoredCvDocument,
  TailorCvResponse,
  TargetYear,
  WorkArrangement,
} from './types'

const ALL_CATEGORIES: JobCategory[] = ['HEOR', 'RWE / Epidemiology', 'Market Access', 'Patient-Centered']
const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'Switzerland', 'Ireland', 'Netherlands',
  'France', 'Belgium', 'Denmark', 'Sweden', 'Norway', 'Australia', 'India', 'Singapore',
]
const OPPORTUNITY_TYPES: OpportunityType[] = ['Internship', 'Full-time job', 'Any']
const YEARS: TargetYear[] = ['Any', '2026', '2027', '2028', '2029', '2030', '2031', '2032']
const SEASONS: Season[] = ['Any', 'Summer', 'Fall', 'Winter', 'Spring']
const DEGREES: DegreeLevel[] = ['Any', 'PhD / Doctoral', 'Graduate', "Master's", "Bachelor's"]
const WORK_ARRANGEMENTS: WorkArrangement[] = ['Any', 'Remote', 'Hybrid', 'On-site']
const SOURCES: SearchSource[] = ['Google Jobs', 'LinkedIn']
const CUTOFFS = [7, 14, 30]

type View = 'discovery' | 'analysis' | 'tailoring' | 'applications' | 'networking'


const DEFAULT_TAILOR_SETTINGS: CvTailoringSettings = {
  format: 'Industry CV · 2 pages',
  emphasis: 'Balanced',
}

const DEFAULT_PROFILE: SearchProfile = {
  cutoffDays: 30,
  opportunityType: 'Internship',
  targetYear: '2027',
  season: 'Summer',
  degree: 'PhD / Doctoral',
  workArrangement: 'Any',
  country: 'United States',
  locationQuery: '',
  sources: ['Google Jobs', 'LinkedIn'],
  categories: ALL_CATEGORIES,
  customKeywords: [],
}

const EMPTY_META: SearchMeta = {
  searchedAt: '', cutoffDays: 30, queriesRun: 0, queriesSucceeded: 0, zeroResultQueries: 0, queryWarnings: [], rawCount: 0, strictCount: 0,
  excludedOld: 0, excludedUnknownDate: 0, excludedClosed: 0, excludedIrrelevant: 0, sourceCounts: {},
}

function storedSavedIds(): string[] {
  try { return JSON.parse(localStorage.getItem('heor-saved-jobs') || '[]') } catch { return [] }
}

function storedProfile(): SearchProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-search-profile') || 'null')
    return parsed ? { ...DEFAULT_PROFILE, ...parsed, customKeywords: Array.isArray(parsed.customKeywords) ? parsed.customKeywords : [] } : DEFAULT_PROFILE
  } catch { return DEFAULT_PROFILE }
}

function storedCv(): CvProfile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-cv-profile') || 'null')
    return parsed?.text ? parsed : null
  } catch { return null }
}

function storedAnalyses(): Map<string, GptAnalysis> {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-gpt-analyses') || '{}') as Record<string, GptAnalysis>
    return new Map(Object.entries(parsed))
  } catch { return new Map() }
}


function storedTailoredCvs(): Map<string, TailoredCvDocument> {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-tailored-cvs') || '{}') as Record<string, TailoredCvDocument>
    return new Map(Object.entries(parsed))
  } catch { return new Map() }
}

function storedTailorSettings(): CvTailoringSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-tailor-settings') || 'null')
    return parsed ? { ...DEFAULT_TAILOR_SETTINGS, ...parsed } : DEFAULT_TAILOR_SETTINGS
  } catch { return DEFAULT_TAILOR_SETTINGS }
}

function storedApplications(): Map<string, ApplicationRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-applications') || '{}') as Record<string, ApplicationRecord>
    return new Map(Object.entries(parsed).map(([id, application]) => [id, {
      ...application,
      eligibilityOverride: Boolean(application.eligibilityOverride),
      eligibilityOverrideReason: application.eligibilityOverrideReason || '',
      companyResolution: application.companyResolution || (application.job?.company && !/company not parsed|unknown company/i.test(application.job.company) ? 'ORIGINAL' : 'UNRESOLVED'),
    }]))
  } catch { return new Map() }
}

function storedApplicationPackages(): Map<string, ApplicationPackage> {
  try {
    const parsed = JSON.parse(localStorage.getItem('heor-application-packages') || '{}') as Record<string, ApplicationPackage>
    return new Map(Object.entries(parsed))
  } catch { return new Map() }
}

function yearSeasonLabel(profile: SearchProfile) {
  return [profile.season !== 'Any' ? profile.season : '', profile.targetYear !== 'Any' ? profile.targetYear : ''].filter(Boolean).join(' ') || 'Any year / season'
}

function keywordMatchesJob(job: Job, keywords: string[]) {
  const text = `${job.title} ${job.description} ${job.highlights.join(' ')} ${job.sourceQuery}`.toLowerCase()
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()))
}

async function readableFunctionError(err: unknown) {
  if (err instanceof FunctionsHttpError) {
    try {
      const payload = await err.context.json()
      return payload?.error || err.message
    } catch { return err.message }
  }
  return err instanceof Error ? err.message : 'Unexpected error.'
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [view, setView] = useState<View>('discovery')
  const [jobs, setJobs] = useState<Job[]>([])
  const [meta, setMeta] = useState<SearchMeta>(EMPTY_META)
  const [profile, setProfile] = useState<SearchProfile>(storedProfile)
  const [cv, setCv] = useState<CvProfile | null>(storedCv)
  const [candidate, setCandidate] = useState<CandidateProfile>(loadCandidateProfile)
  const [depth, setDepth] = useState<AnalysisDepth>('Standard')
  const [analyses, setAnalyses] = useState<Map<string, GptAnalysis>>(storedAnalyses)
  const [tailoredCvs, setTailoredCvs] = useState<Map<string, TailoredCvDocument>>(storedTailoredCvs)
  const [tailorSettings, setTailorSettings] = useState<CvTailoringSettings>(storedTailorSettings)
  const [selectedTailorJobId, setSelectedTailorJobId] = useState('')
  const [tailoringIds, setTailoringIds] = useState<string[]>([])
  const [tailorError, setTailorError] = useState('')
  const [applications, setApplications] = useState<Map<string, ApplicationRecord>>(storedApplications)
  const [applicationPackages, setApplicationPackages] = useState<Map<string, ApplicationPackage>>(storedApplicationPackages)
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [preparingApplicationIds, setPreparingApplicationIds] = useState<string[]>([])
  const [applicationError, setApplicationError] = useState('')
  const [analyzingIds, setAnalyzingIds] = useState<string[]>([])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  const [textFilter, setTextFilter] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [savedIds, setSavedIds] = useState<string[]>(storedSavedIds)

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => localStorage.setItem('heor-saved-jobs', JSON.stringify(savedIds)), [savedIds])
  useEffect(() => localStorage.setItem('heor-search-profile', JSON.stringify(profile)), [profile])
  useEffect(() => localStorage.setItem('heor-candidate-profile', JSON.stringify(candidate)), [candidate])
  useEffect(() => {
    const obj = Object.fromEntries(analyses.entries())
    localStorage.setItem('heor-gpt-analyses', JSON.stringify(obj))
  }, [analyses])
  useEffect(() => {
    const obj = Object.fromEntries(tailoredCvs.entries())
    localStorage.setItem('heor-tailored-cvs', JSON.stringify(obj))
  }, [tailoredCvs])
  useEffect(() => localStorage.setItem('heor-tailor-settings', JSON.stringify(tailorSettings)), [tailorSettings])
  useEffect(() => {
    localStorage.setItem('heor-applications', JSON.stringify(Object.fromEntries(applications.entries())))
  }, [applications])
  useEffect(() => {
    localStorage.setItem('heor-application-packages', JSON.stringify(Object.fromEntries(applicationPackages.entries())))
  }, [applicationPackages])
  useEffect(() => {
    if (cv) localStorage.setItem('heor-cv-profile', JSON.stringify(cv))
    else localStorage.removeItem('heor-cv-profile')
  }, [cv])
  useEffect(() => {
    if (!supabase || !session?.user?.id) return
    let cancelled = false
    supabase.from('applications').select('*').order('updated_at', { ascending: false }).then(({ data, error: loadError }) => {
      if (cancelled || loadError || !data) return
      const loaded = new Map<string, ApplicationRecord>()
      for (const row of data) {
        const job = row.job_snapshot as Job
        if (!job?.id) continue
        loaded.set(String(row.id), {
          id: String(row.id), jobId: String(row.job_id), job,
          status: row.status as ApplicationRecord['status'], deadline: row.deadline || '', appliedAt: row.applied_at || '',
          followUpAt: row.follow_up_at || '', notes: row.notes || '',
          eligibilityOverride: Boolean(row.eligibility_override), eligibilityOverrideReason: row.eligibility_override_reason || '',
          companyResolution: (row.company_resolution || (job.company && !/company not parsed|unknown company/i.test(job.company) ? 'ORIGINAL' : 'UNRESOLVED')) as ApplicationRecord['companyResolution'],
          createdAt: row.created_at, updatedAt: row.updated_at,
        })
      }
      if (loaded.size) setApplications((current) => new Map([...current, ...loaded]))
    })
    return () => { cancelled = true }
  }, [session?.user?.id])

  useEffect(() => {
    if (!supabase || !session?.user?.id) return
    let cancelled = false
    supabase.from('application_packages').select('job_id, package, created_at').order('created_at', { ascending: false }).limit(100).then(({ data, error: loadError }) => {
      if (cancelled || loadError || !data) return
      const loaded = new Map<string, ApplicationPackage>()
      for (const row of data) {
        const jobId = String(row.job_id || '')
        if (!jobId || loaded.has(jobId) || !row.package) continue
        loaded.set(jobId, row.package as ApplicationPackage)
      }
      if (loaded.size) setApplicationPackages((current) => new Map([...current, ...loaded]))
    })
    return () => { cancelled = true }
  }, [session?.user?.id])

  const visibleJobs = useMemo(() => {
    const needle = textFilter.trim().toLowerCase()
    return jobs.filter((job) => {
      if (savedOnly && !savedIds.includes(job.id)) return false
      const areaMatch = profile.categories.includes(job.category) || keywordMatchesJob(job, profile.customKeywords)
      if ((profile.categories.length > 0 || profile.customKeywords.length > 0) && !areaMatch) return false
      if (!needle) return true
      return [job.title, job.company, job.location, job.description, job.category, job.source]
        .join(' ').toLowerCase().includes(needle)
    })
  }, [jobs, textFilter, savedOnly, savedIds, profile.categories, profile.customKeywords])

  const cvMatches = useMemo(() => {
    if (!cv) return new Map<string, ReturnType<typeof calculateCvMatch>>()
    return new Map(jobs.map((job) => [job.id, calculateCvMatch(job, cv, profile.customKeywords)]))
  }, [jobs, cv, profile.customKeywords])

  const sevenDayCount = jobs.filter((j) => j.daysOld <= 7).length
  const directHeor = jobs.filter((j) => j.category === 'HEOR').length
  const linkedinCount = jobs.filter((j) => j.source === 'LinkedIn').length
  const categoryCalls = Math.ceil(profile.categories.length / 2)
  const keywordCalls = Math.ceil(profile.customKeywords.length / 4)
  const estimatedCalls = (categoryCalls + keywordCalls) * profile.sources.length
  const canSearch = (profile.categories.length > 0 || profile.customKeywords.length > 0) && profile.sources.length > 0

  function toggleCategory(category: JobCategory) {
    setProfile((p) => ({ ...p, categories: p.categories.includes(category) ? p.categories.filter((x) => x !== category) : [...p.categories, category] }))
  }

  function toggleSource(source: SearchSource) {
    setProfile((p) => ({ ...p, sources: p.sources.includes(source) ? p.sources.filter((x) => x !== source) : [...p.sources, source] }))
  }

  function addCustomKeyword() {
    const parts = keywordDraft.split(',').map((x) => x.trim()).filter((x) => x.length >= 2)
    if (!parts.length) return
    setProfile((p) => ({ ...p, customKeywords: Array.from(new Set([...p.customKeywords, ...parts])).slice(0, 24) }))
    setKeywordDraft('')
  }

  function removeCustomKeyword(keyword: string) {
    setProfile((p) => ({ ...p, customKeywords: p.customKeywords.filter((x) => x !== keyword) }))
  }

  function resetProfile() {
    setProfile(DEFAULT_PROFILE)
    setJobs([])
    setMeta(EMPTY_META)
    setError('')
  }

  function handleCvChange(nextCv: CvProfile | null) {
    const changed = nextCv?.uploadedAt !== cv?.uploadedAt
    setCv(nextCv)
    if (changed && analyses.size > 0) setAnalyses(new Map())
    if (changed && tailoredCvs.size > 0) setTailoredCvs(new Map())
  }

  async function runSearch() {
    if (!supabase || !canSearch) return
    setRunning(true)
    setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<SearchResponse>('search-jobs', { body: { profile } })
      if (invokeError) throw invokeError
      if (!data) throw new Error('Search returned no data.')
      setJobs(data.jobs)
      setMeta(data.meta)
    } catch (err) {
      setError(await readableFunctionError(err))
    } finally { setRunning(false) }
  }

  async function analyzeJob(job: Job) {
    if (!supabase || !cv) {
      setAnalysisError('Upload a CV before running GPT analysis.')
      return
    }
    setAnalyzingIds((ids) => Array.from(new Set([...ids, job.id])))
    setAnalysisError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<AnalyzeJobResponse>('analyze-job', {
        body: { job, cv, candidate, depth },
      })
      if (invokeError) throw invokeError
      if (!data?.analysis) throw new Error('GPT analysis returned no result.')
      setAnalyses((current) => new Map(current).set(job.id, data.analysis))
    } catch (err) {
      setAnalysisError(await readableFunctionError(err))
    } finally {
      setAnalyzingIds((ids) => ids.filter((id) => id !== job.id))
    }
  }

  async function tailorJob(job: Job) {
    if (!supabase || !cv) {
      setTailorError('Upload a master CV before tailoring.')
      return
    }
    const analysis = analyses.get(job.id)
    if (!analysis) {
      setTailorError('Run Phase 2 GPT analysis for this job before tailoring.')
      return
    }
    setTailoringIds((ids) => Array.from(new Set([...ids, job.id])))
    setTailorError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<TailorCvResponse>('tailor-cv', {
        body: { job, cv, candidate, analysis, settings: tailorSettings, depth },
      })
      if (invokeError) throw invokeError
      if (!data?.tailoredCv) throw new Error('CV tailoring returned no document.')
      setTailoredCvs((current) => new Map(current).set(job.id, data.tailoredCv))
      setSelectedTailorJobId(job.id)
      setView('tailoring')
    } catch (err) {
      setTailorError(await readableFunctionError(err))
    } finally {
      setTailoringIds((ids) => ids.filter((id) => id !== job.id))
    }
  }

  function openTailoring(job: Job) {
    setSelectedTailorJobId(job.id)
    setTailorError('')
    setView('tailoring')
  }

  function updateTailoredDocument(jobId: string, document: TailoredCvDocument) {
    setTailoredCvs((current) => new Map(current).set(jobId, document))
  }

  async function persistApplication(application: ApplicationRecord) {
    if (!supabase || !session?.user?.id) return
    const { error: persistError } = await supabase.from('applications').upsert({
      id: application.id,
      user_id: session.user.id,
      job_id: application.jobId,
      job_snapshot: application.job,
      status: application.status,
      deadline: application.deadline || null,
      applied_at: application.appliedAt || null,
      follow_up_at: application.followUpAt || null,
      notes: application.notes,
      eligibility_override: application.eligibilityOverride,
      eligibility_override_reason: application.eligibilityOverrideReason,
      company_resolution: application.companyResolution,
      created_at: application.createdAt,
      updated_at: application.updatedAt,
    }, { onConflict: 'id' })
    if (persistError) console.warn('Application persistence failed:', persistError.message)
  }

  function trackApplication(job: Job) {
    const existing = Array.from(applications.values()).find((application) => application.jobId === job.id)
    if (existing) {
      setSelectedApplicationId(existing.id)
      setView('applications')
      return
    }
    const now = new Date().toISOString()
    const application: ApplicationRecord = {
      id: crypto.randomUUID(), jobId: job.id, job, status: 'Ready to apply', deadline: '', appliedAt: '', followUpAt: '', notes: '',
      eligibilityOverride: false, eligibilityOverrideReason: '',
      companyResolution: job.company && !/company not parsed|unknown company/i.test(job.company) ? 'ORIGINAL' : 'UNRESOLVED',
      createdAt: now, updatedAt: now,
    }
    setApplications((current) => new Map(current).set(application.id, application))
    setSelectedApplicationId(application.id)
    setApplicationError('')
    void persistApplication(application)
    setView('applications')
  }

  function updateApplication(application: ApplicationRecord) {
    setApplications((current) => new Map(current).set(application.id, application))
    void persistApplication(application)
  }

  async function removeApplication(id: string) {
    const application = applications.get(id)
    setApplications((current) => { const next = new Map(current); next.delete(id); return next })
    if (application) setApplicationPackages((current) => { const next = new Map(current); next.delete(application.jobId); return next })
    if (selectedApplicationId === id) setSelectedApplicationId('')
    if (supabase) await supabase.from('applications').delete().eq('id', id)
  }

  async function prepareApplication(application: ApplicationRecord, customQuestions: Array<{ question: string; maxChars: number | null }>) {
    if (!supabase || !cv) { setApplicationError('Upload a master CV before preparing the application package.'); return }
    const analysis = analyses.get(application.jobId)
    const tailoredCv = tailoredCvs.get(application.jobId)
    if (!analysis) { setApplicationError('Run Phase 2 GPT analysis for this role first.'); return }
    if ((analysis.recommendation === 'SKIP' || analysis.eligibility === 'FAIL') && !application.eligibilityOverride) {
      setApplicationError('Phase 2 marked this role SKIP or eligibility FAIL. Use the explicit eligibility override in Applications before generating a package.'); return
    }
    if (application.eligibilityOverride && application.eligibilityOverrideReason.trim().length < 10) {
      setApplicationError('The eligibility override needs a short reason before application materials can be generated.'); return
    }
    if (!tailoredCv) { setApplicationError('Generate a Phase 3 tailored CV for this role first.'); return }
    setPreparingApplicationIds((ids) => Array.from(new Set([...ids, application.jobId])))
    setApplicationError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<PrepareApplicationResponse>('prepare-application', {
        body: { application, cv, candidate, analysis, tailoredCv, customQuestions, depth },
      })
      if (invokeError) throw invokeError
      if (!data?.applicationPackage) throw new Error('Application preparation returned no package.')
      setApplicationPackages((current) => new Map(current).set(application.jobId, data.applicationPackage))
      if (data.resolvedJob || data.companyResolution) {
        const updatedApplication: ApplicationRecord = {
          ...application,
          job: data.resolvedJob || application.job,
          companyResolution: data.companyResolution?.status || application.companyResolution,
          updatedAt: new Date().toISOString(),
        }
        setApplications((current) => new Map(current).set(application.id, updatedApplication))
        void persistApplication(updatedApplication)
      }
      setSelectedApplicationId(application.id)
      setView('applications')
    } catch (err) {
      setApplicationError(await readableFunctionError(err))
    } finally {
      setPreparingApplicationIds((ids) => ids.filter((id) => id !== application.jobId))
    }
  }

  function updateApplicationPackage(jobId: string, pkg: ApplicationPackage) {
    setApplicationPackages((current) => new Map(current).set(jobId, pkg))
  }

  function toggleSaved(jobId: string) {
    setSavedIds((ids) => ids.includes(jobId) ? ids.filter((id) => id !== jobId) : [...ids, jobId])
  }

  function resetCandidate() { setCandidate(DEFAULT_CANDIDATE_PROFILE) }
  async function signOut() { await supabase?.auth.signOut() }

  if (!isConfigured) return <ConfigMissing />
  if (!authReady) return <div className="loading-screen">Loading secure workspace…</div>
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small"><BriefcaseBusiness size={21} /></div>
          <div><strong>HEOR Career Agent</strong><span>Phase 5</span></div>
        </div>

        <div className="profile-card">
          <div className="profile-kicker">SEARCH PROFILE</div>
          <strong>{profile.opportunityType} · {yearSeasonLabel(profile)}</strong>
          <span>{profile.country}{profile.locationQuery ? ` · ${profile.locationQuery}` : ''}</span>
          <span>{profile.degree} · {profile.workArrangement}</span>
          <span>{profile.customKeywords.length} custom keyword{profile.customKeywords.length === 1 ? '' : 's'} · ≤{profile.cutoffDays} days</span>
        </div>

        <nav className="side-nav">
          <button className={view === 'discovery' ? 'active' : ''} onClick={() => setView('discovery')}><Search size={17} /> Job Discovery</button>
          <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}><Sparkles size={17} /> GPT Analysis <em>{analyses.size || ''}</em></button>
          <button className={view === 'tailoring' ? 'active' : ''} onClick={() => setView('tailoring')}><FilePenLine size={17} /> CV Tailoring <em>{tailoredCvs.size || ''}</em></button>
          <button className={view === 'applications' ? 'active' : ''} onClick={() => setView('applications')}><CheckCircle2 size={17} /> Applications <em>{applications.size || ''}</em></button>
          <button className={view === 'networking' ? 'active' : ''} onClick={() => setView('networking')}><UsersRound size={17} /> Recruiter Outreach</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="connected-line"><Wifi size={14} /> Secure backend connected</div>
          <button className="signout-btn" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        {view === 'networking' ? (
          <NetworkingWorkspace applications={applications} analyses={analyses} cv={cv} candidate={candidate} depth={depth} />
        ) : view === 'applications' ? (
          <>
            {applicationError && <div className="error-box wide analysis-global-error">Applications: {applicationError}</div>}
            <ApplicationsWorkspace jobs={jobs} analyses={analyses} tailoredCvs={tailoredCvs} cv={cv} applications={applications} packages={applicationPackages} selectedApplicationId={selectedApplicationId} generatingIds={preparingApplicationIds} onSelectApplicationId={setSelectedApplicationId} onTrackJob={trackApplication} onUpdateApplication={updateApplication} onRemoveApplication={removeApplication} onGeneratePackage={prepareApplication} onPackageChange={updateApplicationPackage} />
          </>
        ) : view === 'tailoring' ? (
          <>
            {tailorError && <div className="error-box wide analysis-global-error">CV Tailoring: {tailorError}</div>}
            <CvTailoringWorkspace cv={cv} jobs={jobs} analyses={analyses} tailoredCvs={tailoredCvs} selectedJobId={selectedTailorJobId} onSelectJobId={setSelectedTailorJobId} settings={tailorSettings} onSettingsChange={setTailorSettings} generatingIds={tailoringIds} onGenerate={tailorJob} onDocumentChange={updateTailoredDocument} trackedJobIds={Array.from(applications.values()).map((application) => application.jobId)} onTrackJob={trackApplication} />
          </>
        ) : view === 'analysis' ? (
          <>
            {analysisError && <div className="error-box wide analysis-global-error">{analysisError}</div>}
            <AnalysisWorkspace candidate={candidate} onCandidateChange={setCandidate} depth={depth} onDepthChange={setDepth} cv={cv} jobs={jobs} analyses={analyses} analyzingIds={analyzingIds} savedIds={savedIds} onAnalyze={analyzeJob} onTailor={openTailoring} onToggleSave={toggleSaved} />
            <div className="candidate-reset-row"><button className="reset-btn" onClick={resetCandidate}><RotateCcw size={14} /> Reset candidate defaults</button></div>
          </>
        ) : (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">JOB DISCOVERY + CV MATCH</p>
                <h1>Flexible HEOR opportunity radar</h1>
                <p>Search with your own research keywords, scan Google Jobs and public LinkedIn postings, then send promising roles to GPT-5.6 Luna by default, with Sol available only for Deep Review.</p>
              </div>
              <button className="primary-btn search-now" onClick={runSearch} disabled={running || !canSearch}>
                <RefreshCw size={17} className={running ? 'spin' : ''} /> {running ? 'Searching…' : 'Run search now'}
              </button>
            </header>

            <section className="stats-grid">
              <StatCard label="Eligible matches" value={jobs.length} subtext="Passed discovery gates" Icon={BriefcaseBusiness} />
              <StatCard label="Fresh this week" value={sevenDayCount} subtext="Posted ≤7 days ago" Icon={CalendarClock} />
              <StatCard label="Direct HEOR" value={directHeor} subtext="Core HEOR keyword match" Icon={CheckCircle2} />
              <StatCard label="LinkedIn found" value={linkedinCount} subtext={cv ? `${analyses.size} GPT-analyzed` : 'Upload CV for match %'} Icon={Linkedin} />
            </section>

            <section className="control-panel">
              <div className="control-title-row">
                <div className="control-title"><SlidersHorizontal size={18} /><div><strong>Search builder</strong><span>Change parameters before each run. Choices are saved in this browser.</span></div></div>
                <button className="reset-btn" onClick={resetProfile}><RotateCcw size={14} /> Reset</button>
              </div>

              <div className="selector-grid">
                <label><span>Opportunity type</span><select value={profile.opportunityType} onChange={(e) => setProfile((p) => ({ ...p, opportunityType: e.target.value as OpportunityType }))}>{OPPORTUNITY_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label><span>Target year</span><select value={profile.targetYear} onChange={(e) => setProfile((p) => ({ ...p, targetYear: e.target.value as TargetYear }))}>{YEARS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label><span>Season</span><select value={profile.season} onChange={(e) => setProfile((p) => ({ ...p, season: e.target.value as Season }))}>{SEASONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label><span>Degree level</span><select value={profile.degree} onChange={(e) => setProfile((p) => ({ ...p, degree: e.target.value as DegreeLevel }))}>{DEGREES.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label><span>Work arrangement</span><select value={profile.workArrangement} onChange={(e) => setProfile((p) => ({ ...p, workArrangement: e.target.value as WorkArrangement }))}>{WORK_ARRANGEMENTS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label><span>Country</span><select value={profile.country} onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}>{COUNTRIES.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="location-field"><span>City / state / region <em>optional</em></span><input value={profile.locationQuery} onChange={(e) => setProfile((p) => ({ ...p, locationQuery: e.target.value }))} placeholder="e.g., Boston, MA or London" /></label>
                <label><span>Posted within</span><select value={profile.cutoffDays} onChange={(e) => setProfile((p) => ({ ...p, cutoffDays: Number(e.target.value) }))}>{CUTOFFS.map((x) => <option key={x} value={x}>{x} days</option>)}</select></label>
              </div>

              <div className="filter-section">
                <div className="filter-section-copy"><strong>Core research areas</strong><span>Use these presets, your own keywords below, or both.</span></div>
                <div className="category-controls">
                  {ALL_CATEGORIES.map((category) => <label key={category} className={profile.categories.includes(category) ? 'checked' : ''}><input type="checkbox" checked={profile.categories.includes(category)} onChange={() => toggleCategory(category)} />{category}</label>)}
                </div>
              </div>

              <div className="filter-section custom-keyword-section">
                <div className="filter-section-copy"><strong>Custom research keywords</strong><span>Add methods, therapeutic areas, job functions, or exact phrases. Comma-separated entry is supported.</span></div>
                <div className="keyword-builder">
                  <input value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomKeyword() } }} placeholder="e.g., pharmacoeconomics, causal inference, oncology, DCE" />
                  <button className="add-keyword-btn" onClick={addCustomKeyword} disabled={!keywordDraft.trim()}><Plus size={14} /> Add</button>
                </div>
                {profile.customKeywords.length > 0 && <div className="custom-keyword-chips">{profile.customKeywords.map((keyword) => <button key={keyword} onClick={() => removeCustomKeyword(keyword)}>{keyword}<X size={12} /></button>)}</div>}
              </div>

              <div className="filter-section source-section">
                <div className="filter-section-copy"><strong>Search sources</strong><span>LinkedIn is discovered through public job pages indexed by Google; no LinkedIn password is used.</span></div>
                <div className="category-controls source-controls">
                  {SOURCES.map((source) => <label key={source} className={profile.sources.includes(source) ? 'checked' : ''}><input type="checkbox" checked={profile.sources.includes(source)} onChange={() => toggleSource(source)} />{source === 'LinkedIn' && <Linkedin size={13} />}{source}</label>)}
                </div>
                <div className="provider-call-note">Estimated provider calls this run: <strong>{estimatedCalls}</strong>. Custom keywords are grouped four per query to control API usage.</div>
              </div>

              {!canSearch && <div className="inline-warning">Select at least one core research area or add a custom keyword, plus at least one search source.</div>}
            </section>

            <CVPanel cv={cv} onChange={handleCvChange} />

            {error && <div className="error-box wide">{error}</div>}
            {analysisError && <div className="error-box wide">GPT Analysis: {analysisError}</div>}
            {meta.queryWarnings.length > 0 && <div className="warning-box wide">Some searches were skipped: {meta.queryWarnings.join(' · ')}</div>}

            <section className="list-toolbar">
              <div className="search-field"><Search size={17} /><input value={textFilter} onChange={(e) => setTextFilter(e.target.value)} placeholder="Filter current results by company, skill, location or source…" /></div>
              <button className={`filter-btn ${savedOnly ? 'selected' : ''}`} onClick={() => setSavedOnly((x) => !x)}><Filter size={16} /> Saved only</button>
            </section>

            {jobs.length === 0 ? (
              <section className="empty-state">
                <div className="empty-icon"><Search size={25} /></div>
                <h2>{meta.searchedAt ? 'No eligible opportunities found in this search' : 'Ready for a flexible search'}</h2>
                <p>{meta.searchedAt ? `The providers returned ${meta.rawCount} raw posting${meta.rawCount === 1 ? '' : 's'}, but none passed the selected discovery gates. ${meta.zeroResultQueries} of ${meta.queriesRun} provider queries returned no jobs.` : <>Choose your parameters and research keywords above. The server still enforces a maximum 30-day posting-age window and rejects unknown dates.</>}</p>
              </section>
            ) : visibleJobs.length === 0 ? (
              <section className="empty-state compact"><h2>No jobs match these dashboard filters.</h2><p>Your underlying search results are unchanged.</p></section>
            ) : (
              <section className="jobs-list">
                <div className="results-heading">
                  <div><h2>{visibleJobs.length} current match{visibleJobs.length === 1 ? '' : 'es'}</h2><p>{meta.searchedAt ? `Last search ${new Date(meta.searchedAt).toLocaleString()}` : ''}{cv ? ` · CV match enabled using ${cv.fileName}` : ''}</p></div>
                  <div className="audit-pill">Raw {meta.rawCount} → filtered {meta.strictCount}</div>
                </div>
                {visibleJobs.map((job) => <JobCard key={job.id} job={job} saved={savedIds.includes(job.id)} cvMatch={cvMatches.get(job.id)} gptAnalysis={analyses.get(job.id)} analyzing={analyzingIds.includes(job.id)} canAnalyze={Boolean(cv)} onAnalyze={() => analyzeJob(job)} onTailor={analyses.has(job.id) ? () => openTailoring(job) : undefined} onToggleSave={() => toggleSaved(job.id)} />)}
              </section>
            )}

            {meta.searchedAt && (
              <section className="audit-card">
                <strong>Search audit</strong><span>{meta.queriesSucceeded}/{meta.queriesRun} provider queries completed</span><span>Google Jobs {meta.sourceCounts['Google Jobs'] || 0}</span><span>LinkedIn {meta.sourceCounts.LinkedIn || 0}</span><span>{meta.zeroResultQueries} zero-result queries</span><span>{meta.excludedOld} older than {meta.cutoffDays} days</span><span>{meta.excludedUnknownDate} unknown posting date</span><span>{meta.excludedClosed} without active apply route</span><span>{meta.excludedIrrelevant} failed selected filters</span>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
