import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  postedAtLabel: string
  applyUrl: string
  category: string
  opportunityType: string
  degreeSignal: string
  highlights?: string[]
  needsVerification?: boolean
}

type CandidateProfile = {
  expectedGraduation: string
  currentStatus: string
  cptEligible: boolean
  needsFutureSponsorship: boolean
  openToRelocation: boolean
  notes: string
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
      // Some local/legacy environments may expose a raw key here.
      if (/^(?:eyJ|sb_)/.test(packed)) return packed
    }
  }
  return rawEnvKey(...fallbackNames)
}

function cleanInput(value: unknown, max = 50000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max)
}

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
}

function htmlToText(html: string) {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchPublicJobPage(url: string) {
  if (!/^https?:\/\//i.test(url)) return { text: '', fetched: false, reason: 'No public HTTP URL.' }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; HEORCareerAgent/2.0; +https://github.com/)',
        'accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) return { text: '', fetched: false, reason: `Public page returned HTTP ${response.status}.` }
    const contentType = response.headers.get('content-type') || ''
    if (!/html|text/i.test(contentType)) return { text: '', fetched: false, reason: 'Public page was not readable text/HTML.' }
    const raw = (await response.text()).slice(0, 350000)
    const text = htmlToText(raw).slice(0, 28000)
    return { text: text.length >= 250 ? text : '', fetched: text.length >= 250, reason: text.length >= 250 ? '' : 'Too little public page text was extractable.' }
  } catch (error) {
    return { text: '', fetched: false, reason: error instanceof Error ? error.message : 'Public page fetch failed.' }
  } finally {
    clearTimeout(timeout)
  }
}

const analysisSchema = {
  type: 'object',
  properties: {
    recommendation: { type: 'string', enum: ['APPLY', 'REVIEW', 'SKIP'] },
    eligibility: { type: 'string', enum: ['PASS', 'REVIEW', 'FAIL'] },
    eligibilityReason: { type: 'string' },
    sponsorship: { type: 'string', enum: ['COMPATIBLE', 'UNKNOWN', 'INCOMPATIBLE'] },
    sponsorshipReason: { type: 'string' },
    cvMatch: { type: 'integer', minimum: 0, maximum: 100 },
    overallFit: { type: 'integer', minimum: 0, maximum: 100 },
    heorRelevance: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    jobDescriptionCompleteness: { type: 'string', enum: ['FULL', 'PARTIAL', 'SNIPPET'] },
    summary: { type: 'string' },
    requiredQualifications: { type: 'array', items: { type: 'string' }, maxItems: 15 },
    preferredQualifications: { type: 'array', items: { type: 'string' }, maxItems: 15 },
    strengths: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    gaps: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    atsKeywords: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    tailoringActions: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    cautionFlags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    sourceUrls: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    evidenceNotes: { type: 'array', items: { type: 'string' }, maxItems: 10 },
  },
  required: [
    'recommendation', 'eligibility', 'eligibilityReason', 'sponsorship', 'sponsorshipReason',
    'cvMatch', 'overallFit', 'heorRelevance', 'jobDescriptionCompleteness', 'summary',
    'requiredQualifications', 'preferredQualifications', 'strengths', 'gaps', 'atsKeywords',
    'tailoringActions', 'cautionFlags', 'sourceUrls', 'evidenceNotes',
  ],
  additionalProperties: false,
}

function buildPrompt(job: Job, cvText: string, candidate: CandidateProfile, publicPage: { text: string; fetched: boolean; reason: string }) {
  return `Analyze this job for one candidate. Use the supplied evidence and, when useful, web search to locate/corroborate the current public job posting. Do not invent requirements or candidate experience.

DECISION RULES
- Treat CV match as semantic qualifications alignment, independent of hard eligibility. Do not call it an employer ATS score.
- Eligibility must compare degree level, graduation timing, student/current-enrollment requirements, location/work arrangement, and explicit work-authorization language.
- Candidate CPT eligibility is internship authorization context only. It does NOT mean an employer is willing to sponsor now or later.
- Candidate requires future sponsorship: if the posting explicitly says no sponsorship now or in the future, sponsorship=INCOMPATIBLE and eligibility should normally FAIL; recommendation=SKIP.
- If sponsorship is not stated, sponsorship=UNKNOWN. Never infer sponsorship from company reputation or unrelated company-level history.
- If the posting targets a graduation year/date that excludes expected graduation ${candidate.expectedGraduation}, treat that as a hard eligibility problem unless wording clearly permits the candidate.
- If the evidence is a thin snippet and you cannot verify a criterion, mark it REVIEW/UNKNOWN instead of guessing.
- Recommendation APPLY: no hard eligibility conflict and strong enough fit to justify applying.
- Recommendation REVIEW: key eligibility/sponsorship/full-description facts remain ambiguous or fit is borderline.
- Recommendation SKIP: explicit hard ineligibility or clearly poor relevance.
- Tailoring actions may only reframe/reorder facts supported by the CV. Never propose adding an unsupported skill as if possessed.
- Keep each list item concise and specific.

CANDIDATE PROFILE
Expected graduation: ${candidate.expectedGraduation}
Current status: ${candidate.currentStatus}
CPT eligible: ${candidate.cptEligible ? 'Yes' : 'No'}
Needs future sponsorship: ${candidate.needsFutureSponsorship ? 'Yes' : 'No'}
Open to relocation: ${candidate.openToRelocation ? 'Yes' : 'No'}
Notes: ${cleanInput(candidate.notes, 2000) || 'None'}

SEARCH RESULT
Title: ${cleanInput(job.title, 500)}
Company: ${cleanInput(job.company, 500)}
Location: ${cleanInput(job.location, 500)}
Source: ${cleanInput(job.source, 100)}
Category: ${cleanInput(job.category, 100)}
Opportunity type detected: ${cleanInput(job.opportunityType, 100)}
Degree signal from discovery: ${cleanInput(job.degreeSignal, 1000)}
Posted: ${cleanInput(job.postedAtLabel, 100)}
Public URL: ${cleanInput(job.applyUrl, 2000)}
Discovery description/snippet:
${cleanInput(job.description, 8000)}
Discovery highlights: ${(job.highlights || []).join(', ')}

SERVER-SIDE PUBLIC PAGE EXTRACTION
Fetch succeeded: ${publicPage.fetched ? 'Yes' : 'No'}
Fetch note: ${publicPage.reason || 'Public page text extracted.'}
Extracted page text:
${cleanInput(publicPage.text, 28000) || '[No additional page text available]'}

CANDIDATE CV (extracted text; factual source for candidate experience)
${cleanInput(cvText, 60000)}

Return the required structured analysis. Put the original public URL in sourceUrls, plus any highly relevant source URLs you actually used. Evidence notes should distinguish explicit posting facts from inference/unknowns.`
}

function outputText(response: any) {
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

function collectWebSources(response: any) {
  const urls = new Set<string>()
  for (const item of response?.output || []) {
    const sources = item?.action?.sources
    if (Array.isArray(sources)) for (const source of sources) if (source?.url) urls.add(String(source.url))
  }
  return [...urls]
}

async function callOpenAI(apiKey: string, prompt: string, depth: AnalysisDepth, useWeb: boolean) {
  const body: any = {
    model: 'gpt-5.6-sol',
    reasoning: { effort: depth === 'Deep' ? 'high' : 'medium' },
    input: prompt,
    max_output_tokens: 7000,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'heor_job_fit_analysis',
        strict: true,
        schema: analysisSchema,
      },
    },
  }
  if (useWeb) {
    body.tools = [{ type: 'web_search', search_context_size: 'medium' }]
    body.tool_choice = 'auto'
    body.include = ['web_search_call.action.sources']
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI API returned HTTP ${response.status}`
    throw new Error(message)
  }
  return payload
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
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) return Response.json({ error: 'This account is not authorized to run GPT analysis.' }, { status: 403, headers: corsHeaders })

    const body = await req.json().catch(() => ({}))
    const job = body?.job as Job
    const cvText = cleanInput(body?.cv?.text, 70000)
    const candidate = body?.candidate as CandidateProfile
    const depth: AnalysisDepth = body?.depth === 'Standard' ? 'Standard' : 'Deep'

    if (!job?.id || !job?.title || !job?.applyUrl) return Response.json({ error: 'A valid job result is required.' }, { status: 400, headers: corsHeaders })
    if (cvText.length < 100) return Response.json({ error: 'Upload a readable CV before GPT analysis.' }, { status: 400, headers: corsHeaders })
    if (!candidate?.expectedGraduation) return Response.json({ error: 'Candidate expected graduation is required.' }, { status: 400, headers: corsHeaders })

    const publicPage = await fetchPublicJobPage(job.applyUrl)
    const prompt = buildPrompt(job, cvText, candidate, publicPage)

    let response: any
    try {
      response = await callOpenAI(openaiKey, prompt, depth, true)
    } catch (firstError) {
      const message = firstError instanceof Error ? firstError.message : String(firstError)
      console.warn('OpenAI web-assisted analysis failed; retrying without web tool:', message)
      response = await callOpenAI(openaiKey, `${prompt}\n\nWeb tool was unavailable for this run. Base conclusions only on supplied evidence and mark missing facts UNKNOWN/REVIEW.`, depth, false)
    }

    const raw = outputText(response)
    if (!raw) throw new Error('GPT returned no structured analysis text.')
    const parsed = JSON.parse(raw)
    const webSources = collectWebSources(response)
    // Only surface URLs we can ground: the original posting plus URLs returned by the web-search tool.
    // Ignore model-authored URLs to avoid displaying hallucinated links.
    const sourceUrls = Array.from(new Set([job.applyUrl, ...webSources].filter((x: string) => /^https?:\/\//i.test(x)))).slice(0, 8)

    const analysis = {
      ...parsed,
      sourceUrls,
      jobId: job.id,
      analyzedAt: new Date().toISOString(),
      model: 'gpt-5.6-sol',
      reasoningDepth: depth,
      usage: {
        inputTokens: response?.usage?.input_tokens,
        outputTokens: response?.usage?.output_tokens,
        totalTokens: response?.usage?.total_tokens,
      },
    }

    if (secretKey) {
      try {
        const admin = createClient(supabaseUrl, secretKey)
        await admin.from('job_analyses').upsert({
          user_id: user.id,
          job_id: job.id,
          recommendation: analysis.recommendation,
          eligibility: analysis.eligibility,
          sponsorship: analysis.sponsorship,
          cv_match: analysis.cvMatch,
          overall_fit: analysis.overallFit,
          model: analysis.model,
          analysis,
          updated_at: analysis.analyzedAt,
        }, { onConflict: 'user_id,job_id' })
      } catch (persistError) {
        console.warn('Analysis succeeded, persistence skipped:', persistError)
      }
    }

    return Response.json({ analysis }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error instanceof Error ? error.message : 'Unexpected GPT analysis error' }, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
