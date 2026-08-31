import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Filter,
  LogOut,
  RefreshCw,
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
import type { Job, JobCategory, SearchMeta, SearchProfile, SearchResponse } from './types'

const ALL_CATEGORIES: JobCategory[] = ['HEOR', 'RWE / Epidemiology', 'Market Access', 'Patient-Centered']

const DEFAULT_PROFILE: SearchProfile = {
  cutoffDays: 30,
  country: 'United States',
  season: 'Summer 2027',
  degree: 'PhD / Doctoral / Graduate',
  includeRemote: true,
  categories: ALL_CATEGORIES,
}

const EMPTY_META: SearchMeta = {
  searchedAt: '', cutoffDays: 30, queriesRun: 0, rawCount: 0, strictCount: 0,
  excludedOld: 0, excludedUnknownDate: 0, excludedClosed: 0, excludedIrrelevant: 0,
}

function storedSavedIds(): string[] {
  try { return JSON.parse(localStorage.getItem('heor-saved-jobs') || '[]') } catch { return [] }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [meta, setMeta] = useState<SearchMeta>(EMPTY_META)
  const [profile, setProfile] = useState<SearchProfile>(DEFAULT_PROFILE)
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

  useEffect(() => {
    localStorage.setItem('heor-saved-jobs', JSON.stringify(savedIds))
  }, [savedIds])

  const visibleJobs = useMemo(() => {
    const needle = textFilter.trim().toLowerCase()
    return jobs.filter((job) => {
      if (savedOnly && !savedIds.includes(job.id)) return false
      if (!profile.categories.includes(job.category)) return false
      if (!needle) return true
      return [job.title, job.company, job.location, job.description, job.category]
        .join(' ').toLowerCase().includes(needle)
    })
  }, [jobs, textFilter, savedOnly, savedIds, profile.categories])

  const sevenDayCount = jobs.filter((j) => j.daysOld <= 7).length
  const remoteCount = jobs.filter((j) => j.isRemote || j.isHybrid).length
  const directHeor = jobs.filter((j) => j.category === 'HEOR').length

  function toggleCategory(category: JobCategory) {
    setProfile((p) => ({
      ...p,
      categories: p.categories.includes(category)
        ? p.categories.filter((x) => x !== category)
        : [...p.categories, category],
    }))
  }

  async function runSearch() {
    if (!supabase) return
    setRunning(true)
    setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<SearchResponse>('search-jobs', {
        body: { profile },
      })
      if (invokeError) throw invokeError
      if (!data) throw new Error('Search returned no data.')
      setJobs(data.jobs)
      setMeta(data.meta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The search failed. Check Edge Function logs and secrets.')
    } finally {
      setRunning(false)
    }
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  if (!isConfigured) return <ConfigMissing />
  if (!authReady) return <div className="loading-screen">Loading secure workspace…</div>
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small"><BriefcaseBusiness size={21} /></div>
          <div><strong>HEOR Career Agent</strong><span>Phase 1</span></div>
        </div>

        <div className="profile-card">
          <div className="profile-kicker">SEARCH PROFILE</div>
          <strong>Summer 2027 · PhD</strong>
          <span>United States · nationwide</span>
          <span>Strict ≤30-day posting window</span>
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
            <h1>Summer 2027 internship radar</h1>
            <p>HEOR, RWE, epidemiology, market access and patient-centered research — with a hard 30-day cutoff.</p>
          </div>
          <button className="primary-btn search-now" onClick={runSearch} disabled={running}>
            <RefreshCw size={17} className={running ? 'spin' : ''} /> {running ? 'Searching…' : 'Run search now'}
          </button>
        </header>

        <section className="stats-grid">
          <StatCard label="Eligible matches" value={jobs.length} subtext="Passed all Phase 1 gates" Icon={BriefcaseBusiness} />
          <StatCard label="Fresh this week" value={sevenDayCount} subtext="Posted ≤7 days ago" Icon={CalendarClock} />
          <StatCard label="Direct HEOR" value={directHeor} subtext="Core HEOR keyword match" Icon={CheckCircle2} />
          <StatCard label="Remote / hybrid" value={remoteCount} subtext="Flexible work signal" Icon={Wifi} />
        </section>

        <section className="control-panel">
          <div className="control-title"><SlidersHorizontal size={18} /><div><strong>Strict search rules</strong><span>Phase 1 rules are deterministic — no LLM judgment yet.</span></div></div>
          <div className="rule-grid">
            <div><span>Posting age</span><strong>≤ 30 days</strong><small>Locked maximum</small></div>
            <div><span>Season</span><strong>Summer 2027</strong><small>Must be detected</small></div>
            <div><span>Degree</span><strong>PhD / graduate</strong><small>Doctoral signal required</small></div>
            <div><span>Location</span><strong>United States</strong><small>Nationwide + remote</small></div>
          </div>
          <div className="category-controls">
            {ALL_CATEGORIES.map((category) => (
              <label key={category} className={profile.categories.includes(category) ? 'checked' : ''}>
                <input type="checkbox" checked={profile.categories.includes(category)} onChange={() => toggleCategory(category)} />
                {category}
              </label>
            ))}
          </div>
        </section>

        {error && <div className="error-box wide">{error}</div>}

        <section className="list-toolbar">
          <div className="search-field"><Search size={17} /><input value={textFilter} onChange={(e) => setTextFilter(e.target.value)} placeholder="Filter current results by company, skill or location…" /></div>
          <button className={`filter-btn ${savedOnly ? 'selected' : ''}`} onClick={() => setSavedOnly((x) => !x)}><Filter size={16} /> Saved only</button>
        </section>

        {jobs.length === 0 ? (
          <section className="empty-state">
            <div className="empty-icon"><Search size={25} /></div>
            <h2>Ready for the first search</h2>
            <p>Click <strong>Run search now</strong>. The backend will query multiple HEOR/RWE job-search phrases, deduplicate results, reject postings older than 30 days, reject unknown dates, require Summer 2027 + graduate-level signals, and require a live application route.</p>
          </section>
        ) : visibleJobs.length === 0 ? (
          <section className="empty-state compact"><h2>No jobs match these dashboard filters.</h2><p>Your underlying search results are unchanged.</p></section>
        ) : (
          <section className="jobs-list">
            <div className="results-heading">
              <div><h2>{visibleJobs.length} current match{visibleJobs.length === 1 ? '' : 'es'}</h2><p>{meta.searchedAt ? `Last search ${new Date(meta.searchedAt).toLocaleString()}` : ''}</p></div>
              <div className="audit-pill">Raw {meta.rawCount} → strict {meta.strictCount}</div>
            </div>
            {visibleJobs.map((job) => (
              <JobCard key={job.id} job={job} saved={savedIds.includes(job.id)} onToggleSave={() => setSavedIds((ids) => ids.includes(job.id) ? ids.filter((id) => id !== job.id) : [...ids, job.id])} />
            ))}
          </section>
        )}

        {meta.rawCount > 0 && (
          <section className="audit-card">
            <strong>Search audit</strong>
            <span>{meta.queriesRun} provider queries</span>
            <span>{meta.excludedOld} older than 30 days</span>
            <span>{meta.excludedUnknownDate} unknown posting date</span>
            <span>{meta.excludedClosed} without active apply route</span>
            <span>{meta.excludedIrrelevant} failed HEOR/Summer 2027/graduate filters</span>
          </section>
        )}
      </main>
    </div>
  )
}
