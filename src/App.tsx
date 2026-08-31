import { useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError, type Session } from '@supabase/supabase-js'
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Filter,
  Linkedin,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wifi,
} from 'lucide-react'
import ConfigMissing from './components/ConfigMissing'
import JobCard from './components/JobCard'
import Login from './components/Login'
import StatCard from './components/StatCard'
import { isConfigured, supabase } from './lib/supabase'
import type {
  DegreeLevel,
  Job,
  JobCategory,
  OpportunityType,
  SearchMeta,
  SearchProfile,
  SearchResponse,
  SearchSource,
  Season,
  TargetYear,
  WorkArrangement,
} from './types'

const ALL_CATEGORIES: JobCategory[] = ['HEOR', 'RWE / Epidemiology', 'Market Access', 'Patient-Centered']
const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'Switzerland', 'Ireland', 'Netherlands',
  'France', 'Belgium', 'Denmark', 'Sweden', 'Norway', 'Australia', 'India', 'Singapore',
]
const OPPORTUNITY_TYPES: OpportunityType[] = ['Internship', 'Full-time job', 'Any']
const YEARS: TargetYear[] = ['Any', '2026', '2027', '2028', '2029']
const SEASONS: Season[] = ['Any', 'Summer', 'Fall', 'Spring']
const DEGREES: DegreeLevel[] = ['Any', 'PhD / Doctoral', 'Graduate', "Master's", "Bachelor's"]
const WORK_ARRANGEMENTS: WorkArrangement[] = ['Any', 'Remote', 'Hybrid', 'On-site']
const SOURCES: SearchSource[] = ['Google Jobs', 'LinkedIn']
const CUTOFFS = [7, 14, 30]

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
    return parsed ? { ...DEFAULT_PROFILE, ...parsed } : DEFAULT_PROFILE
  } catch { return DEFAULT_PROFILE }
}

function yearSeasonLabel(profile: SearchProfile) {
  return [profile.season !== 'Any' ? profile.season : '', profile.targetYear !== 'Any' ? profile.targetYear : ''].filter(Boolean).join(' ') || 'Any year / season'
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [meta, setMeta] = useState<SearchMeta>(EMPTY_META)
  const [profile, setProfile] = useState<SearchProfile>(storedProfile)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
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

  const visibleJobs = useMemo(() => {
    const needle = textFilter.trim().toLowerCase()
    return jobs.filter((job) => {
      if (savedOnly && !savedIds.includes(job.id)) return false
      if (!profile.categories.includes(job.category)) return false
      if (!needle) return true
      return [job.title, job.company, job.location, job.description, job.category, job.source]
        .join(' ').toLowerCase().includes(needle)
    })
  }, [jobs, textFilter, savedOnly, savedIds, profile.categories])

  const sevenDayCount = jobs.filter((j) => j.daysOld <= 7).length
  const flexibleCount = jobs.filter((j) => j.isRemote || j.isHybrid).length
  const directHeor = jobs.filter((j) => j.category === 'HEOR').length
  const linkedinCount = jobs.filter((j) => j.source === 'LinkedIn').length
  const estimatedCalls = Math.ceil(profile.categories.length / 2) * profile.sources.length
  const canSearch = profile.categories.length > 0 && profile.sources.length > 0

  function toggleCategory(category: JobCategory) {
    setProfile((p) => ({
      ...p,
      categories: p.categories.includes(category) ? p.categories.filter((x) => x !== category) : [...p.categories, category],
    }))
  }

  function toggleSource(source: SearchSource) {
    setProfile((p) => ({
      ...p,
      sources: p.sources.includes(source) ? p.sources.filter((x) => x !== source) : [...p.sources, source],
    }))
  }

  function resetProfile() {
    setProfile(DEFAULT_PROFILE)
    setJobs([])
    setMeta(EMPTY_META)
    setError('')
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
      if (err instanceof FunctionsHttpError) {
        try {
          const payload = await err.context.json()
          setError(payload?.error || err.message)
        } catch { setError(err.message) }
      } else {
        setError(err instanceof Error ? err.message : 'The search failed. Check Edge Function logs and secrets.')
      }
    } finally { setRunning(false) }
  }

  async function signOut() { await supabase?.auth.signOut() }

  if (!isConfigured) return <ConfigMissing />
  if (!authReady) return <div className="loading-screen">Loading secure workspace…</div>
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small"><BriefcaseBusiness size={21} /></div>
          <div><strong>HEOR Career Agent</strong><span>Phase 1.2</span></div>
        </div>

        <div className="profile-card">
          <div className="profile-kicker">SEARCH PROFILE</div>
          <strong>{profile.opportunityType} · {yearSeasonLabel(profile)}</strong>
          <span>{profile.country}{profile.locationQuery ? ` · ${profile.locationQuery}` : ''}</span>
          <span>{profile.degree} · {profile.workArrangement}</span>
          <span>≤{profile.cutoffDays}-day posting window</span>
        </div>

        <nav className="side-nav">
          <button className="active"><Search size={17} /> Job Discovery</button>
          <button disabled><Sparkles size={17} /> GPT Analysis <em>Phase 2</em></button>
          <button disabled><CheckCircle2 size={17} /> Applications <em>Later</em></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="connected-line"><Wifi size={14} /> Secure backend connected</div>
          <button className="signout-btn" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">JOB DISCOVERY</p>
            <h1>Flexible HEOR opportunity radar</h1>
            <p>Build the search you want, then scan Google Jobs and public LinkedIn job pages with a strict recency gate.</p>
          </div>
          <button className="primary-btn search-now" onClick={runSearch} disabled={running || !canSearch}>
            <RefreshCw size={17} className={running ? 'spin' : ''} /> {running ? 'Searching…' : 'Run search now'}
          </button>
        </header>

        <section className="stats-grid">
          <StatCard label="Eligible matches" value={jobs.length} subtext="Passed Phase 1 discovery gates" Icon={BriefcaseBusiness} />
          <StatCard label="Fresh this week" value={sevenDayCount} subtext="Posted ≤7 days ago" Icon={CalendarClock} />
          <StatCard label="Direct HEOR" value={directHeor} subtext="Core HEOR keyword match" Icon={CheckCircle2} />
          <StatCard label="LinkedIn found" value={linkedinCount} subtext={`${flexibleCount} remote / hybrid results`} Icon={Linkedin} />
        </section>

        <section className="control-panel">
          <div className="control-title-row">
            <div className="control-title"><SlidersHorizontal size={18} /><div><strong>Search builder</strong><span>Change the parameters before each run. Choices are saved in this browser.</span></div></div>
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
            <div className="filter-section-copy"><strong>Research areas</strong><span>Select one or more.</span></div>
            <div className="category-controls">
              {ALL_CATEGORIES.map((category) => (
                <label key={category} className={profile.categories.includes(category) ? 'checked' : ''}>
                  <input type="checkbox" checked={profile.categories.includes(category)} onChange={() => toggleCategory(category)} />{category}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section source-section">
            <div className="filter-section-copy"><strong>Search sources</strong><span>LinkedIn is discovered through public job pages indexed by Google; no LinkedIn password is used.</span></div>
            <div className="category-controls source-controls">
              {SOURCES.map((source) => (
                <label key={source} className={profile.sources.includes(source) ? 'checked' : ''}>
                  <input type="checkbox" checked={profile.sources.includes(source)} onChange={() => toggleSource(source)} />
                  {source === 'LinkedIn' && <Linkedin size={13} />}{source}
                </label>
              ))}
            </div>
            <div className="provider-call-note">Estimated provider calls this run: <strong>{estimatedCalls}</strong>. Fewer selected research areas or sources use fewer searches.</div>
          </div>

          {!canSearch && <div className="inline-warning">Select at least one research area and one search source.</div>}
        </section>

        {error && <div className="error-box wide">{error}</div>}
        {meta.queryWarnings.length > 0 && <div className="warning-box wide">Some searches were skipped: {meta.queryWarnings.join(' · ')}</div>}

        <section className="list-toolbar">
          <div className="search-field"><Search size={17} /><input value={textFilter} onChange={(e) => setTextFilter(e.target.value)} placeholder="Filter current results by company, skill, location or source…" /></div>
          <button className={`filter-btn ${savedOnly ? 'selected' : ''}`} onClick={() => setSavedOnly((x) => !x)}><Filter size={16} /> Saved only</button>
        </section>

        {jobs.length === 0 ? (
          <section className="empty-state">
            <div className="empty-icon"><Search size={25} /></div>
            <h2>{meta.searchedAt ? 'No eligible opportunities found in this search' : 'Ready for a flexible search'}</h2>
            <p>{meta.searchedAt
              ? `The providers returned ${meta.rawCount} raw posting${meta.rawCount === 1 ? '' : 's'}, but none passed the selected discovery gates. ${meta.zeroResultQueries} of ${meta.queriesRun} provider queries returned no jobs.`
              : <>Choose internship or job, year, season, country, work arrangement and sources above. The server still enforces a maximum 30-day posting-age window and rejects unknown dates.</>}
            </p>
          </section>
        ) : visibleJobs.length === 0 ? (
          <section className="empty-state compact"><h2>No jobs match these dashboard filters.</h2><p>Your underlying search results are unchanged.</p></section>
        ) : (
          <section className="jobs-list">
            <div className="results-heading">
              <div><h2>{visibleJobs.length} current match{visibleJobs.length === 1 ? '' : 'es'}</h2><p>{meta.searchedAt ? `Last search ${new Date(meta.searchedAt).toLocaleString()}` : ''}</p></div>
              <div className="audit-pill">Raw {meta.rawCount} → filtered {meta.strictCount}</div>
            </div>
            {visibleJobs.map((job) => (
              <JobCard key={job.id} job={job} saved={savedIds.includes(job.id)} onToggleSave={() => setSavedIds((ids) => ids.includes(job.id) ? ids.filter((id) => id !== job.id) : [...ids, job.id])} />
            ))}
          </section>
        )}

        {meta.searchedAt && (
          <section className="audit-card">
            <strong>Search audit</strong>
            <span>{meta.queriesSucceeded}/{meta.queriesRun} provider queries completed</span>
            <span>Google Jobs {meta.sourceCounts['Google Jobs'] || 0}</span>
            <span>LinkedIn {meta.sourceCounts.LinkedIn || 0}</span>
            <span>{meta.zeroResultQueries} zero-result queries</span>
            <span>{meta.excludedOld} older than {meta.cutoffDays} days</span>
            <span>{meta.excludedUnknownDate} unknown posting date</span>
            <span>{meta.excludedClosed} without active apply route</span>
            <span>{meta.excludedIrrelevant} failed selected filters</span>
          </section>
        )}
      </main>
    </div>
  )
}
