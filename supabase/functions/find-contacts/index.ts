import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Job = {
  id: string
  title: string
  company: string
  location: string
  category: string
  description: string
  applyUrl: string
}

type ApplicationRecord = {
  id: string
  jobId: string
  job: Job
  companyResolution: string
}

type GptAnalysis = {
  recommendation: string
  eligibility: string
  heorRelevance: string
  summary: string
  atsKeywords?: string[]
}

type ContactRoleCategory = 'RECRUITER' | 'HIRING_MANAGER' | 'HEOR_RWE_LEADER' | 'OTHER'

type NetworkingContact = {
  id: string
  applicationId: string
  jobId: string
  name: string
  title: string
  company: string
  location: string
  linkedinUrl: string
  sourceUrl: string
  sourceSnippet: string
  publicEmail: string
  roleCategory: ContactRoleCategory
  relevanceScore: number
  relevanceReasons: string[]
  discoveryQuery: string
  status: string
  followUpAt: string
  notes: string
  createdAt: string
  updatedAt: string
}

function rawEnvKey(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value) return value
  }
  return undefined
}

function namedEnvKey(jsonName: string, ...fallbackNames: string[]): string | undefined {
  const packed = Deno.env.get(jsonName)
  if (packed) {
    try {
      const parsed = JSON.parse(packed)
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.default === 'string' && parsed.default) return parsed.default
        const first = Object.values(parsed).find((value) => typeof value === 'string' && value)
        if (typeof first === 'string') return first
      }
    } catch {
      if (/^(?:eyJ|sb_)/.test(packed)) return packed
    }
  }
  return rawEnvKey(...fallbackNames)
}

function clean(value: unknown, max = 4000) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function unresolvedCompany(company: string) {
  return !company || /^(company not parsed|unknown company|unknown)$/i.test(company.trim())
}

function normalizeLinkedInUrl(raw: string) {
  try {
    const url = new URL(raw)
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return raw.split('?')[0].replace(/\/$/, '')
  }
}

function extractPublicEmail(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || []
  return matches.find((email) => !/example\.|linkedin\.|noreply|no-reply/i.test(email)) || ''
}

function parseProfileTitle(rawTitle: string, company: string) {
  const cleaned = clean(rawTitle, 600)
    .replace(/\s*[|·]\s*LinkedIn\s*$/i, '')
    .replace(/\s*[-–—]\s*LinkedIn\s*$/i, '')
    .trim()
  const parts = cleaned.split(/\s[-–—]\s/).map((x) => x.trim()).filter(Boolean)
  const name = parts[0] || cleaned
  let title = parts.slice(1).join(' — ')
  if (title && company && title.toLowerCase() === company.toLowerCase()) title = ''
  return { name: clean(name, 180), title: clean(title, 500) }
}

function roleCategory(title: string, snippet: string): ContactRoleCategory {
  const text = `${title} ${snippet}`.toLowerCase()
  if (/university recruit|campus recruit|early career|talent acquisition|recruiter|recruiting|human resources|hr business partner/.test(text)) return 'RECRUITER'
  const domain = /\bheor\b|health economics|outcomes research|real[- ]world evidence|\brwe\b|market access|value & evidence|value and evidence|pharmacoepidemi|epidemiolog|patient[- ]reported|patient outcomes|evidence generation/.test(text)
  if (domain && /director|head|vice president|vp|lead|manager|principal|executive director/.test(text)) return 'HEOR_RWE_LEADER'
  if (/hiring manager|team lead|director|senior director|manager|head of/.test(text)) return 'HIRING_MANAGER'
  if (domain) return 'HEOR_RWE_LEADER'
  return 'OTHER'
}

function scoreContact(title: string, snippet: string, category: ContactRoleCategory, queryKind: string, job: Job) {
  const text = `${title} ${snippet}`.toLowerCase()
  let score = 35
  const reasons: string[] = []

  if (category === 'RECRUITER') { score += 32; reasons.push('Recruiting / talent-acquisition role') }
  if (category === 'HEOR_RWE_LEADER') { score += 30; reasons.push('HEOR/RWE/value/evidence domain alignment') }
  if (category === 'HIRING_MANAGER') { score += 22; reasons.push('Management / team-lead signal') }
  if (/university recruit|campus recruit|early career/.test(text)) { score += 13; reasons.push('Early-career or university recruiting signal') }
  if (/director|senior director|executive director|head of|vice president|\bvp\b/.test(text)) { score += 8; reasons.push('Senior functional leadership') }
  if (/intern|student|graduate|phd/.test(text)) { score += 5; reasons.push('Student/graduate relevance') }
  if (queryKind === 'domain') score += 5
  if (queryKind === 'recruiting') score += 5

  const categoryText = `${job.category} ${job.title}`.toLowerCase()
  if (categoryText.includes('market access') && /market access|value/.test(text)) { score += 7; reasons.push('Matches job function') }
  if (/heor|rwe|epidemiolog|health economics/.test(categoryText) && /heor|rwe|epidemiolog|health economics/.test(text)) { score += 7; reasons.push('Matches job research area') }

  return { score: Math.max(0, Math.min(100, score)), reasons: Array.from(new Set(reasons)).slice(0, 5) }
}

async function googleSearch(query: string, apiKey: string) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('num', '10')
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Contact discovery provider returned HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.error) {
    const message = String(payload.error)
    if (/hasn['’]?t returned any results|no results|did not return any results/i.test(message)) return []
    throw new Error(message)
  }
  return Array.isArray(payload.organic_results) ? payload.organic_results : []
}

function buildQueries(company: string, job: Job) {
  const safeCompany = `"${company.replace(/["\\]/g, ' ')}"`
  const location = clean(job.location, 120)
  const locationTerm = location && !/^united states$/i.test(location) ? ` "${location.replace(/["\\]/g, ' ')}"` : ''
  return [
    {
      kind: 'recruiting',
      query: `site:linkedin.com/in/ ${safeCompany} ("university recruiter" OR "campus recruiter" OR "early careers" OR "talent acquisition" OR recruiter)${locationTerm}`,
    },
    {
      kind: 'domain',
      query: `site:linkedin.com/in/ ${safeCompany} (HEOR OR "health economics" OR "outcomes research" OR "real world evidence" OR RWE OR "market access" OR "value & evidence" OR "evidence generation")${locationTerm}`,
    },
  ]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const publishableKey = namedEnvKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const serpApiKey = Deno.env.get('SERPAPI_KEY')
    const allowedEmail = Deno.env.get('ALLOWED_EMAIL')?.toLowerCase()
    const authorization = req.headers.get('Authorization')

    if (!supabaseUrl || !publishableKey || !authorization) return Response.json({ error: 'Supabase authentication is not configured.' }, { status: 500, headers: corsHeaders })
    if (!serpApiKey) return Response.json({ error: 'SERPAPI_KEY is missing from Edge Function secrets.' }, { status: 500, headers: corsHeaders })

    const client = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } })
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await client.auth.getUser(token)
    if (userError || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: corsHeaders })
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) return Response.json({ error: 'This account is not authorized.' }, { status: 403, headers: corsHeaders })

    const body = await req.json().catch(() => ({}))
    const application = body?.application as ApplicationRecord | undefined
    const analysis = body?.analysis as GptAnalysis | undefined
    if (!application?.id || !application?.job?.id) return Response.json({ error: 'A tracked application is required.' }, { status: 400, headers: corsHeaders })

    const company = clean(application.job.company, 300)
    if (unresolvedCompany(company)) {
      return Response.json({ error: 'Resolve the company/employer name in Applications before discovering recruiter contacts.' }, { status: 400, headers: corsHeaders })
    }

    const queries = buildQueries(company, application.job)
    const settled = await Promise.allSettled(queries.map(async (entry) => ({ ...entry, results: await googleSearch(entry.query, serpApiKey) })))
    const warnings: string[] = []
    const candidates: NetworkingContact[] = []
    const now = new Date().toISOString()

    for (let i = 0; i < settled.length; i += 1) {
      const result = settled[i]
      const query = queries[i]
      if (result.status === 'rejected') {
        warnings.push(`${query.kind}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
        continue
      }
      for (const item of result.value.results) {
        const link = normalizeLinkedInUrl(clean(item?.link, 1500))
        if (!/linkedin\.com\/(?:in|pub)\//i.test(link)) continue
        const rawTitle = clean(item?.title, 600)
        const snippet = clean(item?.snippet || item?.rich_snippet?.top?.detected_extensions?.join?.(' ') || '', 2500)
        const parsed = parseProfileTitle(rawTitle, company)
        if (!parsed.name || /linkedin|jobs?|people directory/i.test(parsed.name)) continue
        const title = parsed.title || clean(snippet.split(/[.|•]/)[0], 450)
        const category = roleCategory(title, snippet)
        const scored = scoreContact(title, snippet, category, result.value.kind, application.job)
        candidates.push({
          id: crypto.randomUUID(),
          applicationId: application.id,
          jobId: application.jobId,
          name: parsed.name,
          title,
          company,
          location: clean(item?.displayed_link || '', 250),
          linkedinUrl: link,
          sourceUrl: link,
          sourceSnippet: snippet,
          publicEmail: extractPublicEmail(`${rawTitle} ${snippet}`),
          roleCategory: category,
          relevanceScore: scored.score,
          relevanceReasons: scored.reasons,
          discoveryQuery: result.value.query,
          status: 'Discovered',
          followUpAt: '',
          notes: '',
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    const deduped = new Map<string, NetworkingContact>()
    for (const contact of candidates) {
      const key = contact.linkedinUrl.toLowerCase()
      const existing = deduped.get(key)
      if (!existing || contact.relevanceScore > existing.relevanceScore) deduped.set(key, contact)
    }

    const contacts = [...deduped.values()]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 12)

    return Response.json({
      contacts,
      meta: {
        searchedAt: now,
        company,
        queriesRun: queries.length,
        contactsFound: contacts.length,
        warnings,
        phase2Recommendation: analysis?.recommendation || 'UNKNOWN',
      },
    }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('find-contacts error', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Contact discovery failed.' }, { status: 500, headers: corsHeaders })
  }
})
