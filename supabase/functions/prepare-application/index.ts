import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_AI_MODEL = 'gpt-5.6-luna'
const DEEP_REVIEW_MODEL = 'gpt-5.6-sol'

function modelForDepth(depth: AnalysisDepth) {
  return depth === 'Deep' ? DEEP_REVIEW_MODEL : DEFAULT_AI_MODEL
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AnalysisDepth = 'Standard' | 'Deep'

type Job = {
  id: string
  title: string
  company: string
  location: string
  source: string
  description: string
  applyUrl: string
  category: string
  degreeSignal: string
  highlights?: string[]
}

type CandidateProfile = {
  expectedGraduation: string
  currentStatus: string
  cptEligible: boolean
  needsFutureSponsorship: boolean
  openToRelocation: boolean
  notes: string
}

type GptAnalysis = {
  recommendation: string
  eligibility: string
  eligibilityReason: string
  sponsorship: string
  sponsorshipReason: string
  cvMatch: number
  overallFit: number
  heorRelevance: string
  summary: string
  requiredQualifications: string[]
  preferredQualifications: string[]
  strengths: string[]
  gaps: string[]
  atsKeywords: string[]
  tailoringActions: string[]
  cautionFlags: string[]
}

type TailoredCvDocument = {
  projectedAlignment: number
  sections: Array<{
    title: string
    blocks: Array<{ heading: string; subheading: string; meta: string; bullets: Array<{ text: string }> }>
  }>
  retainedGaps: string[]
  factLock: { passed: boolean }
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

function cleanInput(value: unknown, max = 70000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max)
}

function canonical(text: string) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
    .replace(/[•◦▪▫■□●○◆◇►▸‣⁃·\u2022\uf0b7]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function lexicalCanonical(text: string) {
  return canonical(text).replace(/[^a-z0-9+#./ -]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function evidenceExists(evidence: string, cvCanonical: string, cvLexical: string) {
  const needle = canonical(evidence)
  if (needle.length < 2) return false
  if (cvCanonical.includes(needle)) return true
  const lexicalNeedle = lexicalCanonical(evidence)
  if (!lexicalNeedle) return false
  if (cvLexical.includes(lexicalNeedle)) return true
  if (lexicalNeedle.length <= 12 && !lexicalNeedle.includes(' ')) {
    const escaped = lexicalNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(cvLexical)
  }
  return false
}

const evidenceArray = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 }

const packageSchema = {
  type: 'object',
  properties: {
    coverLetter: {
      type: 'object',
      properties: {
        greeting: { type: 'string' },
        paragraphs: {
          type: 'array', minItems: 3, maxItems: 5,
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, text: { type: 'string' }, sourceEvidence: evidenceArray },
            required: ['id', 'text', 'sourceEvidence'], additionalProperties: false,
          },
        },
        closing: { type: 'string' },
      },
      required: ['greeting', 'paragraphs', 'closing'], additionalProperties: false,
    },
    answers: {
      type: 'array', minItems: 4, maxItems: 14,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, question: { type: 'string' }, answer: { type: 'string' },
          maxChars: { anyOf: [{ type: 'integer', minimum: 1, maximum: 10000 }, { type: 'null' }] },
          sourceEvidence: evidenceArray, warning: { type: 'string' },
        },
        required: ['id', 'question', 'answer', 'maxChars', 'sourceEvidence', 'warning'], additionalProperties: false,
      },
    },
    submissionChecklist: { type: 'array', items: { type: 'string' }, minItems: 6, maxItems: 14 },
  },
  required: ['coverLetter', 'answers', 'submissionChecklist'], additionalProperties: false,
}

function tailoredCvText(document: TailoredCvDocument) {
  const lines: string[] = []
  for (const section of document.sections || []) {
    lines.push(section.title)
    for (const block of section.blocks || []) {
      lines.push(block.heading, block.subheading, block.meta)
      for (const bullet of block.bullets || []) lines.push(bullet.text)
    }
  }
  return lines.filter(Boolean).join('\n').slice(0, 45000)
}

function buildPrompt(job: Job, cvText: string, candidate: CandidateProfile, analysis: GptAnalysis, tailoredCv: TailoredCvDocument, customQuestions: Array<{ question: string; maxChars: number | null }>) {
  const custom = customQuestions.length
    ? customQuestions.map((item, i) => `${i + 1}. ${cleanInput(item.question, 1000)}${item.maxChars ? ` (maximum ${item.maxChars} characters)` : ''}`).join('\n')
    : 'None.'

  return `Prepare a truthful application package for this job. The candidate will personally review and submit the application.

FACT LOCK — NON-NEGOTIABLE
- The MASTER CV below is the only factual source for candidate experience, skills, degrees, dates, publications, projects, employment, achievements, and methods.
- NEVER invent or upgrade candidate qualifications.
- Every cover-letter paragraph and every application answer MUST include 1–4 sourceEvidence strings that are exact contiguous excerpts copied from the MASTER CV. Use the shortest evidence sufficient to support the candidate claims.
- If the job asks for an unsupported qualification, do not claim it. Phrase adjacent experience accurately or leave it as a gap.
- Do not state that the candidate has already graduated. Expected graduation is separate candidate-profile information.
- Do not answer employer legal/immigration checkbox questions in the generated answer bank. Work authorization guidance is generated deterministically by the server.
- If a custom question asks about visa/work authorization/sponsorship, protected demographic information, disability, veteran status, criminal/legal attestations, salary consent, or other compliance declarations, OMIT that custom question from the answer bank and leave it for the candidate to answer directly.
- Do not claim sponsorship availability by the employer unless Phase 2 explicitly verified it.
- Do not call any score an employer ATS score.

JOB
Title: ${cleanInput(job.title, 500)}
Company: ${cleanInput(job.company, 500)}
Location: ${cleanInput(job.location, 500)}
Category: ${cleanInput(job.category, 100)}
Degree signal: ${cleanInput(job.degreeSignal, 1200)}
Description/snippet: ${cleanInput(job.description, 9000)}
Highlights: ${(job.highlights || []).join(' | ')}
Application URL: ${cleanInput(job.applyUrl, 2000)}

PHASE 2 ANALYSIS
Recommendation: ${analysis.recommendation}
Eligibility: ${analysis.eligibility} — ${cleanInput(analysis.eligibilityReason, 2500)}
Sponsorship: ${analysis.sponsorship} — ${cleanInput(analysis.sponsorshipReason, 2500)}
CV match: ${analysis.cvMatch}%
Overall fit: ${analysis.overallFit}%
HEOR relevance: ${analysis.heorRelevance}
Summary: ${cleanInput(analysis.summary, 4000)}
Required qualifications: ${(analysis.requiredQualifications || []).join(' | ')}
Preferred qualifications: ${(analysis.preferredQualifications || []).join(' | ')}
Strengths: ${(analysis.strengths || []).join(' | ')}
Gaps: ${(analysis.gaps || []).join(' | ')}
Priority keywords: ${(analysis.atsKeywords || []).join(' | ')}
Cautions: ${(analysis.cautionFlags || []).join(' | ')}

CANDIDATE PROFILE — use for context, not as CV evidence
Expected graduation: ${cleanInput(candidate.expectedGraduation, 100)}
Current status: ${cleanInput(candidate.currentStatus, 500)}
CPT eligible as reported by candidate: ${candidate.cptEligible ? 'Yes' : 'No'}
Needs future sponsorship as reported by candidate: ${candidate.needsFutureSponsorship ? 'Yes' : 'No'}
Open to relocation: ${candidate.openToRelocation ? 'Yes' : 'No'}
Notes: ${cleanInput(candidate.notes, 1500) || 'None'}

TAILORED CV DRAFT — wording/context only; MASTER CV remains factual authority
${tailoredCvText(tailoredCv)}
Retained gaps: ${(tailoredCv.retainedGaps || []).join(' | ')}

MASTER CV — ONLY FACTUAL SOURCE FOR CANDIDATE CLAIMS
${cleanInput(cvText, 80000)}

APPLICATION PACKAGE REQUIREMENTS
1. Cover letter: concise, professional, approximately 300–450 words total. Do not invent a named hiring manager. Use "Dear Hiring Team," unless a name is explicitly supplied in the job data.
2. Standard answer bank MUST include these questions:
   - Why are you interested in this role/company?
   - Why are you a strong fit for this role?
   - Describe your most relevant research or professional experience.
   - Which technical/research skills are most relevant to this role?
3. Add the custom employer questions below, preserving each question wording and any maximum character limit. Answers must fit the stated limit when provided.
4. warning should be empty unless an answer needs human verification or depends on ambiguous job details.
5. submissionChecklist should be action-oriented and specific to final human review: tailored CV attached, dates/titles checked, sponsorship questions answered exactly as worded, cover letter reviewed, required uploads present, and final submit performed by the candidate.

CUSTOM EMPLOYER QUESTIONS
${custom}

Return only the required structured JSON.`
}

function outputText(response: any) {
  const chunks: string[] = []
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') chunks.push(content.text)
    }
  }
  return chunks.join('')
}

async function callOpenAI(apiKey: string, prompt: string, depth: AnalysisDepth) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelForDepth(depth),
      reasoning: { effort: depth === 'Deep' ? 'high' : 'medium' },
      input: prompt,
      max_output_tokens: 12000,
      store: false,
      text: { format: { type: 'json_schema', name: 'application_package', strict: true, schema: packageSchema } },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API returned HTTP ${response.status}`)
  if (payload?.status === 'incomplete') throw new Error(`GPT application package was incomplete (${payload?.incomplete_details?.reason || 'output limit'}). Try again with fewer custom questions.`)
  const raw = outputText(payload)
  if (!raw) throw new Error('GPT returned no application package.')
  try { return JSON.parse(raw) } catch (error) { throw new Error(`GPT returned malformed application JSON (${error instanceof Error ? error.message : 'invalid JSON'}).`) }
}

function applyFactLock(draft: any, cvText: string) {
  const cvCanonical = canonical(cvText)
  const cvLexical = lexicalCanonical(cvText)
  const rejected: string[] = []
  let verified = 0

  const validateEvidence = (items: unknown, label: string) => {
    const evidence = Array.isArray(items) ? items.map(String).filter(Boolean) : []
    if (!evidence.length) {
      rejected.push(`${label}: no CV evidence supplied`)
      return false
    }
    const valid = evidence.every((item) => evidenceExists(item, cvCanonical, cvLexical))
    if (!valid) rejected.push(`${label}: unsupported CV evidence`)
    else verified += evidence.length
    return valid
  }

  const paragraphs = (draft?.coverLetter?.paragraphs || []).filter((paragraph: any) => validateEvidence(paragraph.sourceEvidence, `Cover-letter paragraph ${paragraph.id || ''}`))
  const answers = (draft?.answers || []).filter((answer: any) => validateEvidence(answer.sourceEvidence, `Answer: ${answer.question || answer.id || ''}`))

  return {
    ...draft,
    coverLetter: { ...draft.coverLetter, paragraphs },
    answers,
    factLock: {
      passed: rejected.length === 0,
      verifiedEvidence: verified,
      rejectedItems: rejected.slice(0, 20),
      notes: [
        'Candidate claims in generated cover-letter paragraphs and application answers require exact evidence excerpts from the uploaded master CV.',
        'Work-authorization guidance is derived from the candidate profile and must still be matched to the employer question wording before submission.',
        'Manual edits made after generation are not automatically re-verified by the server.',
      ],
    },
  }
}

function authorizationGuidance(candidate: CandidateProfile) {
  const current = candidate.currentStatus?.trim() || 'Current work-authorization status was not provided.'
  const currentAuthorization = candidate.cptEligible
    ? `${current}. Candidate reports CPT eligibility for an internship; authorization for a specific role remains subject to school/DSO approval before work begins.`
    : `${current}. Candidate did not report CPT eligibility in the application profile.`
  const futureSponsorship = candidate.needsFutureSponsorship
    ? 'Candidate reports that future employment sponsorship will be required. Do not answer “No” to a present-or-future sponsorship question merely because CPT may cover the internship.'
    : 'Candidate reports that future employment sponsorship is not required; verify this remains accurate before submission.'
  const relocation = candidate.openToRelocation
    ? 'Candidate reports willingness to relocate; confirm location-specific timing and costs before committing.'
    : 'Candidate has not indicated willingness to relocate; do not claim relocation flexibility.'
  return {
    currentAuthorization,
    futureSponsorship,
    relocation,
    cautions: [
      'Read each employer work-authorization question literally; “authorized for this internship” and “need sponsorship now or in the future” are different questions.',
      'CPT is not automatic: obtain the required school/DSO authorization for the specific employer and dates before beginning employment.',
      'Do not let generated prose override official immigration guidance or employer instructions.',
    ],
  }
}


function companyIsUsable(company: string, jobTitle = '') {
  const value = cleanInput(company, 180)
  if (!value || /^(?:company not parsed|unknown company|unknown|n\/a|linkedin)$/i.test(value)) return false
  if (jobTitle && canonical(value) === canonical(jobTitle)) return false
  return value.length >= 2 && value.length <= 160
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim()
}

function parseCompanyFromPageTitle(rawTitle: string, job: Job) {
  const cleaned = decodeHtml(rawTitle).replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, '').trim()
  const hiring = cleaned.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i)
  if (hiring && companyIsUsable(hiring[1], job.title)) return hiring[1].trim()
  const at = cleaned.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|–—]\s*.+)?$/i)
  if (at && companyIsUsable(at[2], job.title)) return at[2].trim()

  const jobNeedle = canonical(job.title).replace(/\.{3}$/g, '').trim()
  const segments = cleaned.split(/\s+[|–—]\s+/).map((x) => x.trim()).filter(Boolean)
  for (const segment of segments) {
    const c = canonical(segment)
    if (!c || c === jobNeedle || jobNeedle.includes(c) || c.includes(jobNeedle)) continue
    if (/^(?:united states|remote|hybrid|on-site|onsite)$/i.test(segment)) continue
    if (companyIsUsable(segment, job.title)) return segment
  }
  return ''
}

function companyFromJsonLd(html: string) {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).replace(/^\s*<!--|-->\s*$/g, ''))
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed]
      while (queue.length) {
        const node: any = queue.shift()
        if (!node || typeof node !== 'object') continue
        const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '')
        if (/JobPosting/i.test(type)) {
          const name = node?.hiringOrganization?.name
          if (typeof name === 'string' && companyIsUsable(name)) return cleanInput(name, 160)
        }
        if (Array.isArray(node['@graph'])) queue.push(...node['@graph'])
      }
    } catch {
      // Ignore malformed structured-data blocks and continue to deterministic fallbacks.
    }
  }
  return ''
}

function safePublicUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' || host === '::1') return null
    if (/^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) return null
    return url
  } catch { return null }
}

async function fetchPublicHtml(start: URL) {
  let current = start
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HEORCareerAgent/1.0; +https://github.com/)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return { response, html: '' }
      const next = safePublicUrl(new URL(location, current).toString())
      if (!next) throw new Error('Application page redirected to a non-public URL.')
      current = next
      continue
    }
    const html = response.ok ? (await response.text()).slice(0, 900000) : ''
    return { response, html }
  }
  throw new Error('Application page exceeded the redirect limit.')
}

async function resolveCompany(job: Job, currentResolution: string) {
  if (companyIsUsable(job.company, job.title)) {
    const status = currentResolution === 'MANUAL' ? 'MANUAL' : 'ORIGINAL'
    return { job, status, company: job.company, source: status === 'MANUAL' ? 'manual application edit' : 'job discovery data' }
  }

  const url = safePublicUrl(job.applyUrl)
  if (!url) return { job, status: 'UNRESOLVED', company: job.company, source: 'invalid or private application URL' }

  try {
    const { response, html } = await fetchPublicHtml(url)
    if (!response.ok) return { job, status: 'UNRESOLVED', company: job.company, source: `application page HTTP ${response.status}` }

    const structured = companyFromJsonLd(html)
    if (companyIsUsable(structured, job.title)) {
      const resolvedJob = { ...job, company: structured }
      return { job: resolvedJob, status: 'RECOVERED', company: structured, source: 'JobPosting structured data' }
    }

    const directPatterns = [
      /"companyName"\s*:\s*"([^"]{2,160})"/i,
      /"hiringOrganization"\s*:\s*\{[^{}]{0,600}"name"\s*:\s*"([^"]{2,160})"/i,
      /(?:company|employer)[_-]?name["']?\s*[:=]\s*["']([^"']{2,160})["']/i,
    ]
    for (const pattern of directPatterns) {
      const match = html.match(pattern)
      const value = match ? decodeHtml(match[1]) : ''
      if (companyIsUsable(value, job.title)) {
        const resolvedJob = { ...job, company: value }
        return { job: resolvedJob, status: 'RECOVERED', company: value, source: 'application-page company metadata' }
      }
    }

    const titleCandidates = [
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '',
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] || '',
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '',
    ]
    for (const candidate of titleCandidates) {
      const company = parseCompanyFromPageTitle(candidate, job)
      if (companyIsUsable(company, job.title)) {
        const resolvedJob = { ...job, company }
        return { job: resolvedJob, status: 'RECOVERED', company, source: 'application-page title metadata' }
      }
    }
  } catch (error) {
    console.warn('Company recovery failed:', error instanceof Error ? error.message : String(error))
  }

  return { job, status: 'UNRESOLVED', company: job.company, source: 'public application page did not expose a reliable employer name' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const publishableKey = namedEnvKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY')
    const secretKey = namedEnvKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const allowedEmail = Deno.env.get('ALLOWED_EMAIL')?.toLowerCase()
    const authorization = req.headers.get('Authorization')

    if (!supabaseUrl || !publishableKey || !authorization) return Response.json({ error: 'Supabase authentication is not configured.' }, { status: 500, headers: corsHeaders })
    if (!openaiKey) return Response.json({ error: 'OPENAI_API_KEY is missing from Edge Function secrets.' }, { status: 500, headers: corsHeaders })

    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    const userClient = createClient(supabaseUrl, publishableKey)
    const { data: { user }, error: userError } = await userClient.auth.getUser(token)
    if (userError || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: corsHeaders })
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) return Response.json({ error: 'This account is not authorized to prepare applications.' }, { status: 403, headers: corsHeaders })

    const body = await req.json().catch(() => ({}))
    const application = body?.application
    const job = application?.job as Job
    const cvText = cleanInput(body?.cv?.text, 90000)
    const candidate = body?.candidate as CandidateProfile
    const analysis = body?.analysis as GptAnalysis
    const tailoredCv = body?.tailoredCv as TailoredCvDocument
    const customQuestions = Array.isArray(body?.customQuestions) ? body.customQuestions.slice(0, 10) : []
    const depth: AnalysisDepth = body?.depth === 'Standard' ? 'Standard' : 'Deep'

    if (!application?.id || !job?.id || !job?.title || !job?.applyUrl) return Response.json({ error: 'A tracked application with a valid job is required.' }, { status: 400, headers: corsHeaders })
    if (cvText.length < 100) return Response.json({ error: 'Upload a readable master CV before preparing the application package.' }, { status: 400, headers: corsHeaders })
    if (!analysis?.recommendation || typeof analysis.cvMatch !== 'number') return Response.json({ error: 'Phase 2 GPT analysis is required.' }, { status: 400, headers: corsHeaders })
    if (!tailoredCv?.sections?.length) return Response.json({ error: 'Generate a tailored CV before preparing the application package.' }, { status: 400, headers: corsHeaders })

    const hardBlocked = analysis.recommendation === 'SKIP' || analysis.eligibility === 'FAIL'
    if (hardBlocked && !application?.eligibilityOverride) {
      return Response.json({ error: 'Phase 2 marked this role SKIP or eligibility FAIL. An explicit application guardrail override is required before generating application materials.' }, { status: 409, headers: corsHeaders })
    }
    if (hardBlocked && cleanInput(application?.eligibilityOverrideReason, 1000).length < 10) {
      return Response.json({ error: 'The eligibility guardrail override requires a short reason (at least 10 characters).' }, { status: 409, headers: corsHeaders })
    }

    const companyResolution = await resolveCompany(job, cleanInput(application?.companyResolution, 40))
    if (companyResolution.status === 'UNRESOLVED' || !companyIsUsable(companyResolution.company, job.title)) {
      return Response.json({
        error: 'The employer name could not be reliably recovered from this posting. Enter the company/employer name in the Applications workspace, then generate the package again.',
        companyResolution: { status: 'UNRESOLVED', company: job.company, source: companyResolution.source },
      }, { status: 422, headers: corsHeaders })
    }
    const resolvedJob = companyResolution.job as Job

    const draft = await callOpenAI(openaiKey, buildPrompt(resolvedJob, cvText, candidate, analysis, tailoredCv, customQuestions), depth)
    const locked = applyFactLock(draft, cvText)
    if (locked.coverLetter.paragraphs.length < 2 || locked.answers.length < 3) throw new Error('Fact lock rejected too much generated application content. Regenerate after checking that the master CV contains the relevant experience.')

    const applicationPackage = {
      ...locked,
      jobId: job.id,
      generatedAt: new Date().toISOString(),
      model: modelForDepth(depth),
      authorizationGuidance: authorizationGuidance(candidate),
    }

    if (secretKey) {
      try {
        const admin = createClient(supabaseUrl, secretKey)
        await admin.from('application_packages').insert({
          user_id: user.id,
          application_id: application.id,
          job_id: job.id,
          model: applicationPackage.model,
          fact_lock_passed: applicationPackage.factLock.passed,
          package: applicationPackage,
        })
      } catch (persistError) {
        console.warn('Application package succeeded, persistence skipped:', persistError)
      }
    }

    return Response.json({
      applicationPackage,
      resolvedJob,
      companyResolution: { status: companyResolution.status, company: companyResolution.company, source: companyResolution.source },
    }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error instanceof Error ? error.message : 'Unexpected application preparation error' }, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
