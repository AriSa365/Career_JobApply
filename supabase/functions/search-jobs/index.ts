import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RawJob = Record<string, any>

type Category = 'HEOR' | 'RWE / Epidemiology' | 'Market Access' | 'Patient-Centered' | 'Other'

const QUERY_GROUPS = [
  '2027 health economics outcomes research internship',
  '2027 real world evidence epidemiology internship',
  '2027 market access value evidence internship',
  '2027 patient outcomes research internship',
]

const KEYWORD_GROUPS: Record<Exclude<Category, 'Other'>, string[]> = {
  'HEOR': ['heor', 'health economics', 'outcomes research', 'health economic', 'cost effectiveness', 'cost-effectiveness', 'economic model', 'budget impact'],
  'RWE / Epidemiology': ['real world evidence', 'real-world evidence', 'rwe', 'real world data', 'real-world data', 'epidemiology', 'epidemiologic', 'pharmacoepidemiology', 'observational research'],
  'Market Access': ['market access', 'value access', 'value & access', 'value and access', 'payer', 'reimbursement', 'pricing', 'value evidence'],
  'Patient-Centered': ['patient centered outcomes', 'patient-centered outcomes', 'patient reported outcomes', 'patient-reported outcomes', 'pro ', 'patient preference', 'discrete choice experiment', 'best-worst scaling'],
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

  // Strict policy: month/year-relative labels are ambiguous around the 30-day cutoff.
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

  // Some providers return an explicit calendar date instead of a relative age.
  const parsed = new Date(label)
  if (!Number.isNaN(parsed.getTime())) {
    const days = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000)
    if (days < 0) return null
    return { days, iso: parsed.toISOString() }
  }

  return null
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
  return 'No graduate-level signal'
}

function scoreJob(text: string, title: string, category: Category) {
  const lower = text.toLowerCase()
  const titleLower = title.toLowerCase()
  let score = 30
  if (category === 'HEOR') score += 18
  else if (category !== 'Other') score += 12
  if (/heor|health economics|outcomes research/.test(titleLower)) score += 17
  if (/real.?world evidence|epidemiolog|market access|patient.?reported|patient preference/.test(titleLower)) score += 12
  if (/\bph\.?d\b|doctoral|doctorate/.test(lower)) score += 9
  else if (/graduate student|graduate program/.test(lower)) score += 5
  if (/summer\s+2027/.test(lower)) score += 8
  if (/systematic literature review|meta-analysis|economic model|cost-effectiveness|budget impact/.test(lower)) score += 6
  if (/\br\b|sas|python|sql|stata/.test(lower)) score += 4
  return Math.min(99, score)
}

function displayHighlights(text: string) {
  const lower = text.toLowerCase()
  return DISPLAY_KEYWORDS.filter((term) => lower.includes(term.toLowerCase())).slice(0, 8)
}

function isSummer2027(text: string) {
  const lower = text.toLowerCase()
  return lower.includes('2027') && /(summer|june|july|august|10-week|12-week)/.test(lower)
}

function hasGraduateSignal(text: string) {
  return /\bph\.?d\b|doctoral|doctorate|graduate student|graduate program|advanced degree/i.test(text)
}

function hasInternSignal(text: string) {
  return /\bintern(ship)?\b/i.test(text)
}

function hasRelevantSignal(text: string) {
  const lower = text.toLowerCase()
  return Object.values(KEYWORD_GROUPS).flat().some((term) => lower.includes(term))
}

function isClosed(text: string) {
  return /no longer accepting|applications? closed|position has been filled|job has expired|posting expired/i.test(text)
}

async function searchSerpApi(query: string, apiKey: string) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_jobs')
  url.searchParams.set('q', query)
  url.searchParams.set('location', 'United States')
  url.searchParams.set('hl', 'en')
  url.searchParams.set('gl', 'us')
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Job provider returned HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.error) {
    const message = String(payload.error)
    // SerpApi may report an empty Google Jobs page through the `error` field.
    // An empty batch is a valid search outcome and must not fail the whole run.
    if (/hasn['’]?t returned any results|no results|did not return any results/i.test(message)) return []
    throw new Error(message)
  }
  return Array.isArray(payload.jobs_results) ? payload.jobs_results : []
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

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: corsHeaders })
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) {
      return Response.json({ error: 'This account is not authorized to run searches.' }, { status: 403, headers: corsHeaders })
    }

    const requestBody = await req.json().catch(() => ({}))
    const requestedCutoff = Number(requestBody?.profile?.cutoffDays || 30)
    const cutoffDays = Math.min(30, Math.max(1, requestedCutoff)) // hard server-side maximum

    const settledBatches = await Promise.allSettled(
      QUERY_GROUPS.map(async (query) => ({ query, jobs: await searchSerpApi(query, serpApiKey) })),
    )

    const rawBatches: { query: string; jobs: RawJob[] }[] = []
    const queryWarnings: string[] = []
    let zeroResultQueries = 0

    settledBatches.forEach((result, index) => {
      const query = QUERY_GROUPS[index]
      if (result.status === 'fulfilled') {
        rawBatches.push(result.value)
        if (result.value.jobs.length === 0) zeroResultQueries += 1
      } else {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
        queryWarnings.push(`${query}: ${message}`)
        console.warn('Job provider query failed:', query, message)
      }
    })

    // If every provider call truly failed (auth, quota, provider outage, etc.), surface the failure.
    // Empty result sets are not failures and therefore still count as fulfilled batches above.
    if (rawBatches.length === 0 && queryWarnings.length > 0) {
      throw new Error(`All job-provider queries failed. ${queryWarnings.join(' | ')}`)
    }

    const meta = {
      searchedAt: new Date().toISOString(),
      cutoffDays,
      queriesRun: QUERY_GROUPS.length,
      queriesSucceeded: rawBatches.length,
      zeroResultQueries,
      queryWarnings,
      rawCount: rawBatches.reduce((sum, batch) => sum + batch.jobs.length, 0),
      strictCount: 0,
      excludedOld: 0,
      excludedUnknownDate: 0,
      excludedClosed: 0,
      excludedIrrelevant: 0,
    }

    const deduped = new Map<string, any>()

    for (const batch of rawBatches) {
      for (const raw of batch.jobs) {
        const fullText = textOf(raw)
        const postedLabel = raw?.detected_extensions?.posted_at || ''
        const age = parsePostedAge(postedLabel)
        if (!age) { meta.excludedUnknownDate += 1; continue }
        if (age.days > cutoffDays) { meta.excludedOld += 1; continue }

        const applyOptions = Array.isArray(raw.apply_options)
          ? raw.apply_options.filter((x: any) => x?.link).map((x: any) => ({ title: x.title || 'Apply', link: x.link }))
          : []
        if (applyOptions.length === 0 || isClosed(fullText)) { meta.excludedClosed += 1; continue }

        if (!hasInternSignal(fullText) || !isSummer2027(fullText) || !hasGraduateSignal(fullText) || !hasRelevantSignal(fullText)) {
          meta.excludedIrrelevant += 1
          continue
        }

        const title = raw.title || 'Untitled role'
        const company = raw.company_name || 'Unknown company'
        const location = raw.location || ''
        const category = categoryFor(fullText)
        const stableKey = `${normalize(title)}|${normalize(company)}|${normalize(location)}`
        const id = raw.job_id || fnv1a(stableKey)
        const scheduleText = [raw?.detected_extensions?.schedule_type, ...(raw.extensions || [])].join(' ').toLowerCase()
        const candidate = {
          id,
          title,
          company,
          location,
          via: raw.via || 'Google Jobs',
          description: String(raw.description || '').slice(0, 1800),
          postedAtLabel: postedLabel,
          postedAtISO: age.iso,
          daysOld: age.days,
          applyUrl: applyOptions[0].link,
          applyOptions,
          category,
          matchScore: scoreJob(fullText, title, category),
          isRemote: Boolean(raw?.detected_extensions?.work_from_home) || /remote|work from home/.test(scheduleText),
          isHybrid: /hybrid/.test(fullText.toLowerCase()),
          degreeSignal: degreeSignal(fullText),
          sourceQuery: batch.query,
          highlights: displayHighlights(fullText),
        }

        const existing = deduped.get(stableKey)
        if (!existing || candidate.matchScore > existing.matchScore) deduped.set(stableKey, candidate)
      }
    }

    const jobs = Array.from(deduped.values()).sort((a, b) => {
      if (a.daysOld !== b.daysOld) return a.daysOld - b.daysOld
      return b.matchScore - a.matchScore
    })
    meta.strictCount = jobs.length

    // Persistence is best-effort; live search still succeeds before the migration is applied.
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
            jobs.map((job) => ({
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
              source: job.via,
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
