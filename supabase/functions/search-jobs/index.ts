import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RawJob = Record<string, any>
type Category = 'HEOR' | 'RWE / Epidemiology' | 'Market Access' | 'Patient-Centered' | 'Other'
type OpportunityType = 'Internship' | 'Full-time job' | 'Any'
type TargetYear = 'Any' | '2026' | '2027' | '2028' | '2029'
type Season = 'Any' | 'Summer' | 'Fall' | 'Spring'
type DegreeLevel = 'Any' | 'PhD / Doctoral' | 'Graduate' | "Master's" | "Bachelor's"
type WorkArrangement = 'Any' | 'Remote' | 'Hybrid' | 'On-site'
type SearchSource = 'Google Jobs' | 'LinkedIn'

type SearchProfile = {
  cutoffDays: number
  opportunityType: OpportunityType
  targetYear: TargetYear
  season: Season
  degree: DegreeLevel
  workArrangement: WorkArrangement
  country: string
  locationQuery: string
  sources: SearchSource[]
  categories: Category[]
}

const COUNTRY_CONFIG: Record<string, { gl: string; cr: string; label: string }> = {
  'United States': { gl: 'us', cr: 'US', label: 'United States' },
  'Canada': { gl: 'ca', cr: 'CA', label: 'Canada' },
  'United Kingdom': { gl: 'uk', cr: 'GB', label: 'United Kingdom' },
  'Germany': { gl: 'de', cr: 'DE', label: 'Germany' },
  'Switzerland': { gl: 'ch', cr: 'CH', label: 'Switzerland' },
  'Ireland': { gl: 'ie', cr: 'IE', label: 'Ireland' },
  'Netherlands': { gl: 'nl', cr: 'NL', label: 'Netherlands' },
  'France': { gl: 'fr', cr: 'FR', label: 'France' },
  'Belgium': { gl: 'be', cr: 'BE', label: 'Belgium' },
  'Denmark': { gl: 'dk', cr: 'DK', label: 'Denmark' },
  'Sweden': { gl: 'se', cr: 'SE', label: 'Sweden' },
  'Norway': { gl: 'no', cr: 'NO', label: 'Norway' },
  'Australia': { gl: 'au', cr: 'AU', label: 'Australia' },
  'India': { gl: 'in', cr: 'IN', label: 'India' },
  'Singapore': { gl: 'sg', cr: 'SG', label: 'Singapore' },
}

const CATEGORY_SEARCH_TERMS: Record<Exclude<Category, 'Other'>, string> = {
  'HEOR': '("health economics" OR HEOR OR "outcomes research")',
  'RWE / Epidemiology': '("real world evidence" OR RWE OR epidemiology OR pharmacoepidemiology)',
  'Market Access': '("market access" OR "value evidence" OR reimbursement OR payer)',
  'Patient-Centered': '("patient reported outcomes" OR "patient preference" OR "patient outcomes")',
}

const KEYWORD_GROUPS: Record<Exclude<Category, 'Other'>, string[]> = {
  'HEOR': ['heor', 'health economics', 'outcomes research', 'health economic', 'cost effectiveness', 'cost-effectiveness', 'economic model', 'budget impact'],
  'RWE / Epidemiology': ['real world evidence', 'real-world evidence', 'rwe', 'real world data', 'real-world data', 'epidemiology', 'epidemiologic', 'pharmacoepidemiology', 'observational research'],
  'Market Access': ['market access', 'value access', 'value & access', 'value and access', 'payer', 'reimbursement', 'pricing', 'value evidence'],
  'Patient-Centered': ['patient centered outcomes', 'patient-centered outcomes', 'patient reported outcomes', 'patient-reported outcomes', 'patient preference', 'discrete choice experiment', 'best-worst scaling'],
}

const DISPLAY_KEYWORDS = [
  'HEOR', 'health economics', 'outcomes research', 'RWE', 'real-world evidence', 'epidemiology',
  'pharmacoepidemiology', 'market access', 'patient-reported outcomes', 'patient preference',
  'economic modeling', 'cost-effectiveness', 'systematic literature review', 'meta-analysis',
]

function envKey(jsonName: string, legacyName: string): string | undefined {
  const packed = Deno.env.get(jsonName)
  if (packed) {
    try {
      const parsed = JSON.parse(packed)
      if (parsed.default) return parsed.default
      const first = Object.values(parsed)[0]
      if (typeof first === 'string') return first
    } catch { /* fall back */ }
  }
  return Deno.env.get(legacyName)
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function parsePostedAge(label: string): { days: number; iso: string } | null {
  if (!label) return null
  const text = label.toLowerCase().trim()
  const now = new Date()
  const result = new Date(now)

  if (/(today|just posted|just now)/.test(text)) return { days: 0, iso: result.toISOString() }
  if (/yesterday/.test(text)) {
    result.setUTCDate(result.getUTCDate() - 1)
    return { days: 1, iso: result.toISOString() }
  }
  if (/month|year|30\+|over 30|more than 30/.test(text)) return null

  const match = text.match(/(\d+)\s*(minute|hour|day|week)s?\s*(ago)?/)
  if (match) {
    const n = Number(match[1])
    const unit = match[2]
    let days = 0
    if (unit === 'minute' || unit === 'hour') days = 0
    if (unit === 'day') days = n
    if (unit === 'week') days = n * 7
    result.setUTCDate(result.getUTCDate() - days)
    return { days, iso: result.toISOString() }
  }

  const parsed = new Date(label)
  if (!Number.isNaN(parsed.getTime())) {
    const days = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000)
    if (days < 0) return null
    return { days, iso: parsed.toISOString() }
  }
  return null
}

function recentLabelFromSnippet(value: string) {
  return value.match(/(?:today|yesterday|just posted|just now|\d+\s+(?:minutes?|hours?|days?|weeks?)\s+ago)/i)?.[0] || ''
}

function textOf(job: RawJob) {
  const highlights = Array.isArray(job.job_highlights)
    ? job.job_highlights.flatMap((section: any) => section?.items || []).join(' ')
    : ''
  return [job.title, job.company_name, job.description, highlights, ...(job.extensions || [])].filter(Boolean).join(' ')
}

function categoryFor(text: string): Category {
  const lower = text.toLowerCase()
  let best: Category = 'Other'
  let bestScore = 0
  for (const [category, terms] of Object.entries(KEYWORD_GROUPS) as [Exclude<Category, 'Other'>, string[]][]) {
    const score = terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0)
    if (score > bestScore) { best = category; bestScore = score }
  }
  return best
}

function degreeSignal(text: string) {
  const lower = text.toLowerCase()
  if (/\bph\.?d\b|doctoral|doctorate/.test(lower)) return 'PhD / doctoral explicitly mentioned'
  if (/graduate student|graduate program|advanced degree/.test(lower)) return 'Graduate-level eligibility mentioned'
  if (/master['’]?s|masters degree/.test(lower)) return "Master's explicitly mentioned"
  if (/bachelor['’]?s|bachelors degree/.test(lower)) return "Bachelor's explicitly mentioned"
  return 'Degree requirement not visible in search text'
}

function degreeMatches(text: string, degree: DegreeLevel) {
  if (degree === 'Any') return true
  if (degree === 'PhD / Doctoral') return /\bph\.?d\b|doctoral|doctorate/i.test(text)
  if (degree === 'Graduate') return /\bph\.?d\b|doctoral|doctorate|graduate student|graduate program|advanced degree|master['’]?s/i.test(text)
  if (degree === "Master's") return /master['’]?s|masters degree/i.test(text)
  return /bachelor['’]?s|bachelors degree/i.test(text)
}

function detectOpportunity(text: string): OpportunityType {
  if (/\bintern(ship)?\b/i.test(text)) return 'Internship'
  if (/full[ -]?time|permanent position|regular employee/i.test(text)) return 'Full-time job'
  return 'Any'
}

function opportunityMatches(text: string, type: OpportunityType) {
  if (type === 'Any') return true
  if (type === 'Internship') return /\bintern(ship)?\b/i.test(text)
  return !/\bintern(ship)?\b/i.test(text) && /full[ -]?time|permanent|regular employee|employment type.?full/i.test(text)
}

function yearMatches(text: string, year: TargetYear) {
  return year === 'Any' || text.includes(year)
}

function seasonMatches(text: string, season: Season) {
  if (season === 'Any') return true
  const lower = text.toLowerCase()
  if (season === 'Summer') return /summer|june|july|august/.test(lower)
  if (season === 'Fall') return /fall|autumn|september|october|november/.test(lower)
  return /spring|january|february|march|april|may/.test(lower)
}

function workSignals(text: string, detectedRemote = false) {
  const lower = text.toLowerCase()
  return {
    remote: detectedRemote || /\bremote\b|work from home|home[- ]based/.test(lower),
    hybrid: /\bhybrid\b/.test(lower),
    onsite: /on[- ]?site|onsite|in[- ]person|work from office|office[- ]based/.test(lower),
  }
}

function workMatches(signals: ReturnType<typeof workSignals>, arrangement: WorkArrangement) {
  if (arrangement === 'Any') return true
  if (arrangement === 'Remote') return signals.remote
  if (arrangement === 'Hybrid') return signals.hybrid
  return signals.onsite
}

function hasRelevantSignal(text: string) {
  const lower = text.toLowerCase()
  return Object.values(KEYWORD_GROUPS).flat().some((term) => lower.includes(term))
}

function isClosed(text: string) {
  return /no longer accepting|applications? closed|position has been filled|job has expired|posting expired/i.test(text)
}

function scoreJob(text: string, title: string, category: Category, profile: SearchProfile) {
  const lower = text.toLowerCase()
  const titleLower = title.toLowerCase()
  let score = 30
  if (category === 'HEOR') score += 18
  else if (category !== 'Other') score += 12
  if (/heor|health economics|outcomes research/.test(titleLower)) score += 17
  if (/real.?world evidence|epidemiolog|market access|patient.?reported|patient preference/.test(titleLower)) score += 12
  if (/\bph\.?d\b|doctoral|doctorate/.test(lower)) score += 9
  else if (/graduate student|graduate program/.test(lower)) score += 5
  if (profile.targetYear !== 'Any' && lower.includes(profile.targetYear)) score += 5
  if (profile.season !== 'Any' && seasonMatches(text, profile.season)) score += 4
  if (/systematic literature review|meta-analysis|economic model|cost-effectiveness|budget impact/.test(lower)) score += 6
  if (/\br\b|sas|python|sql|stata/.test(lower)) score += 4
  return Math.min(99, score)
}

function displayHighlights(text: string) {
  const lower = text.toLowerCase()
  return DISPLAY_KEYWORDS.filter((term) => lower.includes(term.toLowerCase())).slice(0, 8)
}

function safeProfile(input: any): SearchProfile {
  const opportunityTypes: OpportunityType[] = ['Internship', 'Full-time job', 'Any']
  const years: TargetYear[] = ['Any', '2026', '2027', '2028', '2029']
  const seasons: Season[] = ['Any', 'Summer', 'Fall', 'Spring']
  const degrees: DegreeLevel[] = ['Any', 'PhD / Doctoral', 'Graduate', "Master's", "Bachelor's"]
  const arrangements: WorkArrangement[] = ['Any', 'Remote', 'Hybrid', 'On-site']
  const sources: SearchSource[] = ['Google Jobs', 'LinkedIn']
  const categories: Exclude<Category, 'Other'>[] = ['HEOR', 'RWE / Epidemiology', 'Market Access', 'Patient-Centered']

  const cutoffDays = Math.min(30, Math.max(1, Number(input?.cutoffDays || 30)))
  const country = COUNTRY_CONFIG[input?.country] ? input.country : 'United States'
  const selectedCategories = Array.isArray(input?.categories) ? input.categories.filter((x: string) => categories.includes(x as any)) : categories
  const selectedSources = Array.isArray(input?.sources) ? input.sources.filter((x: string) => sources.includes(x as any)) : sources

  return {
    cutoffDays,
    opportunityType: opportunityTypes.includes(input?.opportunityType) ? input.opportunityType : 'Internship',
    targetYear: years.includes(input?.targetYear) ? input.targetYear : '2027',
    season: seasons.includes(input?.season) ? input.season : 'Summer',
    degree: degrees.includes(input?.degree) ? input.degree : 'PhD / Doctoral',
    workArrangement: arrangements.includes(input?.workArrangement) ? input.workArrangement : 'Any',
    country,
    locationQuery: String(input?.locationQuery || '').trim().slice(0, 120),
    sources: selectedSources.length ? selectedSources : ['Google Jobs'],
    categories: selectedCategories.length ? selectedCategories : categories,
  }
}

function queryModifiers(profile: SearchProfile) {
  const opportunity = profile.opportunityType === 'Internship' ? 'internship' : profile.opportunityType === 'Full-time job' ? 'full time' : ''
  const year = profile.targetYear === 'Any' ? '' : profile.targetYear
  const season = profile.season === 'Any' ? '' : profile.season
  const degree = profile.degree === 'PhD / Doctoral' ? 'PhD' : profile.degree === 'Graduate' ? 'graduate' : profile.degree === "Master's" ? "master's" : profile.degree === "Bachelor's" ? 'bachelor' : ''
  const work = profile.workArrangement === 'Any' ? '' : profile.workArrangement
  return [opportunity, year, season, degree, work].filter(Boolean).join(' ')
}

function buildThemeQueries(profile: SearchProfile) {
  const selected = profile.categories.filter((x): x is Exclude<Category, 'Other'> => x !== 'Other')
  const chunks: Exclude<Category, 'Other'>[][] = []
  for (let i = 0; i < selected.length; i += 2) chunks.push(selected.slice(i, i + 2))
  const modifiers = queryModifiers(profile)
  return chunks.map((chunk) => `${chunk.map((c) => CATEGORY_SEARCH_TERMS[c]).join(' OR ')} ${modifiers}`.trim())
}

async function searchGoogleJobs(query: string, profile: SearchProfile, apiKey: string) {
  const country = COUNTRY_CONFIG[profile.country]
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_jobs')
  url.searchParams.set('q', query)
  url.searchParams.set('location', profile.locationQuery || country.label)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('gl', country.gl)
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Google Jobs provider returned HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.error) {
    const message = String(payload.error)
    if (/hasn['’]?t returned any results|no results|did not return any results/i.test(message)) return []
    throw new Error(message)
  }
  return Array.isArray(payload.jobs_results) ? payload.jobs_results : []
}

async function searchLinkedIn(query: string, profile: SearchProfile, apiKey: string) {
  const country = COUNTRY_CONFIG[profile.country]
  const location = profile.locationQuery || country.label
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', `site:linkedin.com/jobs/view ${query} ${location}`)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('gl', country.gl)
  url.searchParams.set('cr', `country${country.cr}`)
  url.searchParams.set('tbs', 'qdr:m')
  url.searchParams.set('num', '10')
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`LinkedIn discovery provider returned HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.error) {
    const message = String(payload.error)
    if (/hasn['’]?t returned any results|no results|did not return any results/i.test(message)) return []
    throw new Error(message)
  }
  return (Array.isArray(payload.organic_results) ? payload.organic_results : [])
    .filter((x: any) => /linkedin\.com\/jobs\/view/i.test(String(x?.link || '')))
}

function parseLinkedInTitle(rawTitle: string) {
  const cleaned = rawTitle.replace(/\s*[|\-–]\s*LinkedIn\s*$/i, '').trim()
  const hiring = cleaned.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+)$/i)
  if (hiring) return { company: hiring[1].trim(), title: hiring[2].trim(), location: hiring[3].trim() }
  const at = cleaned.match(/^(.+?)\s+at\s+(.+)$/i)
  if (at) return { company: at[2].trim(), title: at[1].trim(), location: '' }
  return { company: 'Company not parsed', title: cleaned || 'LinkedIn job posting', location: '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    const serpApiKey = Deno.env.get('SERPAPI_KEY')
    const allowedEmail = Deno.env.get('ALLOWED_EMAIL')?.toLowerCase()
    const authorization = req.headers.get('Authorization')

    if (!supabaseUrl || !publishableKey || !authorization) {
      return Response.json({ error: 'Supabase authentication is not configured.' }, { status: 500, headers: corsHeaders })
    }
    if (!serpApiKey) return Response.json({ error: 'SERPAPI_KEY is missing from Edge Function secrets.' }, { status: 500, headers: corsHeaders })

    const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: corsHeaders })
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) {
      return Response.json({ error: 'This account is not authorized to run searches.' }, { status: 403, headers: corsHeaders })
    }

    const requestBody = await req.json().catch(() => ({}))
    const profile = safeProfile(requestBody?.profile)
    const themeQueries = buildThemeQueries(profile)

    const tasks: { source: SearchSource; query: string; run: () => Promise<RawJob[]> }[] = []
    for (const query of themeQueries) {
      if (profile.sources.includes('Google Jobs')) tasks.push({ source: 'Google Jobs', query, run: () => searchGoogleJobs(query, profile, serpApiKey) })
      if (profile.sources.includes('LinkedIn')) tasks.push({ source: 'LinkedIn', query, run: () => searchLinkedIn(query, profile, serpApiKey) })
    }

    const settled = await Promise.allSettled(tasks.map(async (task) => ({ ...task, jobs: await task.run() })))
    const batches: { source: SearchSource; query: string; jobs: RawJob[] }[] = []
    const queryWarnings: string[] = []
    let zeroResultQueries = 0

    settled.forEach((result, index) => {
      const task = tasks[index]
      if (result.status === 'fulfilled') {
        batches.push({ source: result.value.source, query: result.value.query, jobs: result.value.jobs })
        if (result.value.jobs.length === 0) zeroResultQueries += 1
      } else {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
        queryWarnings.push(`${task.source} — ${task.query}: ${message}`)
        console.warn('Job provider query failed:', task.source, task.query, message)
      }
    })

    if (batches.length === 0 && queryWarnings.length > 0) throw new Error(`All job-provider queries failed. ${queryWarnings.join(' | ')}`)

    const meta = {
      searchedAt: new Date().toISOString(),
      cutoffDays: profile.cutoffDays,
      queriesRun: tasks.length,
      queriesSucceeded: batches.length,
      zeroResultQueries,
      queryWarnings,
      rawCount: batches.reduce((sum, batch) => sum + batch.jobs.length, 0),
      strictCount: 0,
      excludedOld: 0,
      excludedUnknownDate: 0,
      excludedClosed: 0,
      excludedIrrelevant: 0,
      sourceCounts: {} as Partial<Record<SearchSource, number>>,
      profile,
    }

    const deduped = new Map<string, any>()

    for (const batch of batches) {
      for (const raw of batch.jobs) {
        if (batch.source === 'Google Jobs') {
          const fullText = textOf(raw)
          const postedLabel = raw?.detected_extensions?.posted_at || ''
          const age = parsePostedAge(postedLabel)
          if (!age) { meta.excludedUnknownDate += 1; continue }
          if (age.days > profile.cutoffDays) { meta.excludedOld += 1; continue }

          const applyOptions = Array.isArray(raw.apply_options)
            ? raw.apply_options.filter((x: any) => x?.link).map((x: any) => ({ title: x.title || 'Apply', link: x.link }))
            : []
          if (applyOptions.length === 0 || isClosed(fullText)) { meta.excludedClosed += 1; continue }

          const detectedRemote = Boolean(raw?.detected_extensions?.work_from_home)
          const signals = workSignals(fullText, detectedRemote)
          if (!hasRelevantSignal(fullText) || !opportunityMatches(fullText, profile.opportunityType) || !yearMatches(fullText, profile.targetYear)
            || !seasonMatches(fullText, profile.season) || !degreeMatches(fullText, profile.degree) || !workMatches(signals, profile.workArrangement)) {
            meta.excludedIrrelevant += 1
            continue
          }

          const title = raw.title || 'Untitled role'
          const company = raw.company_name || 'Unknown company'
          const location = raw.location || ''
          const category = categoryFor(fullText)
          const stableKey = `${normalize(title)}|${normalize(company)}|${normalize(location)}`
          const candidate = {
            id: raw.job_id || fnv1a(stableKey),
            title,
            company,
            location,
            via: raw.via || 'Google Jobs',
            source: 'Google Jobs' as SearchSource,
            description: String(raw.description || '').slice(0, 1800),
            postedAtLabel: postedLabel,
            postedAtISO: age.iso,
            daysOld: age.days,
            applyUrl: applyOptions[0].link,
            applyOptions,
            category,
            matchScore: scoreJob(fullText, title, category, profile),
            isRemote: signals.remote,
            isHybrid: signals.hybrid,
            isOnsite: signals.onsite,
            opportunityType: detectOpportunity(fullText),
            degreeSignal: degreeSignal(fullText),
            sourceQuery: batch.query,
            highlights: displayHighlights(fullText),
            needsVerification: false,
          }
          const existing = deduped.get(stableKey)
          if (!existing || candidate.matchScore > existing.matchScore) deduped.set(stableKey, candidate)
        } else {
          const parsedTitle = parseLinkedInTitle(String(raw.title || ''))
          const snippet = String(raw.snippet || '')
          const fullText = [parsedTitle.title, parsedTitle.company, parsedTitle.location, snippet].join(' ')
          const postedLabel = String(raw.date || recentLabelFromSnippet(snippet))
          const age = parsePostedAge(postedLabel)
          if (!age) { meta.excludedUnknownDate += 1; continue }
          if (age.days > profile.cutoffDays) { meta.excludedOld += 1; continue }
          if (!raw.link || isClosed(fullText)) { meta.excludedClosed += 1; continue }

          const signals = workSignals(fullText)
          if (!hasRelevantSignal(`${fullText} ${batch.query}`) || !yearMatches(`${fullText} ${batch.query}`, profile.targetYear)
            || !seasonMatches(`${fullText} ${batch.query}`, profile.season)) {
            meta.excludedIrrelevant += 1
            continue
          }
          // Public Google snippets often omit degree, employment type, and work-mode details.
          // Keep the posting as a discovery candidate when those details are not visible, but flag it for verification.
          const opportunityVisible = opportunityMatches(fullText, profile.opportunityType)
          const degreeVisible = degreeMatches(fullText, profile.degree)
          const workVisible = workMatches(signals, profile.workArrangement)
          const needsVerification = (profile.opportunityType !== 'Any' && !opportunityVisible)
            || (profile.degree !== 'Any' && !degreeVisible)
            || (profile.workArrangement !== 'Any' && !workVisible)

          const category = categoryFor(`${fullText} ${batch.query}`)
          const stableKey = `${normalize(parsedTitle.title)}|${normalize(parsedTitle.company)}|${normalize(parsedTitle.location)}`
          const candidate = {
            id: fnv1a(`linkedin|${raw.link}|${stableKey}`),
            title: parsedTitle.title,
            company: parsedTitle.company,
            location: parsedTitle.location || profile.locationQuery || profile.country,
            via: 'LinkedIn public job page',
            source: 'LinkedIn' as SearchSource,
            description: snippet.slice(0, 1800),
            postedAtLabel,
            postedAtISO: age.iso,
            daysOld: age.days,
            applyUrl: raw.link,
            applyOptions: [{ title: 'Open on LinkedIn', link: raw.link }],
            category,
            matchScore: Math.max(30, scoreJob(`${fullText} ${batch.query}`, parsedTitle.title, category, profile) - (needsVerification ? 8 : 0)),
            isRemote: signals.remote,
            isHybrid: signals.hybrid,
            isOnsite: signals.onsite,
            opportunityType: detectOpportunity(fullText),
            degreeSignal: degreeVisible ? degreeSignal(fullText) : 'Not visible in public LinkedIn search snippet — verify posting',
            sourceQuery: batch.query,
            highlights: displayHighlights(`${fullText} ${batch.query}`),
            needsVerification: true,
          }
          const existing = deduped.get(stableKey)
          if (!existing || candidate.matchScore > existing.matchScore || existing.source !== 'Google Jobs') deduped.set(stableKey, candidate)
        }
      }
    }

    const jobs = Array.from(deduped.values()).sort((a, b) => {
      if (a.daysOld !== b.daysOld) return a.daysOld - b.daysOld
      if (a.needsVerification !== b.needsVerification) return Number(a.needsVerification) - Number(b.needsVerification)
      return b.matchScore - a.matchScore
    })
    meta.strictCount = jobs.length
    meta.sourceCounts = jobs.reduce((acc: Partial<Record<SearchSource, number>>, job: any) => {
      acc[job.source] = (acc[job.source] || 0) + 1
      return acc
    }, {})

    if (secretKey) {
      try {
        const admin = createClient(supabaseUrl, secretKey)
        const runId = crypto.randomUUID()
        await admin.from('search_runs').insert({
          id: runId,
          user_id: user.id,
          searched_at: meta.searchedAt,
          raw_count: meta.rawCount,
          strict_count: meta.strictCount,
          meta,
        })
        if (jobs.length) {
          await admin.from('job_postings').upsert(
            jobs.map((job: any) => ({
              id: job.id,
              user_id: user.id,
              title: job.title,
              company: job.company,
              location: job.location,
              category: job.category,
              posted_at: job.postedAtISO,
              posted_label: job.postedAtLabel,
              days_old: job.daysOld,
              match_score: job.matchScore,
              apply_url: job.applyUrl,
              source: job.source,
              description: job.description,
              payload: job,
              last_seen_at: meta.searchedAt,
            })),
            { onConflict: 'id,user_id' },
          )
        }
      } catch (persistError) {
        console.warn('Search succeeded, persistence skipped:', persistError)
      }
    }

    return Response.json({ jobs, meta }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error(error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected search error' },
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
