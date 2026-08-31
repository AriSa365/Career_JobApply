import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AnalysisDepth = 'Standard' | 'Deep'
type CvTailoringFormat = 'Industry CV · 2 pages' | 'Academic CV · full' | 'Concise resume · 1 page'
type CvTailoringEmphasis = 'Balanced' | 'HEOR / research' | 'Quantitative / technical'

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
  sponsorship: string
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

type TailoringSettings = {
  format: CvTailoringFormat
  emphasis: CvTailoringEmphasis
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
      redirect: 'follow', signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HEORCareerAgent/3.0; +https://github.com/)', 'accept': 'text/html,application/xhtml+xml' },
    })
    if (!response.ok) return { text: '', fetched: false, reason: `Public page returned HTTP ${response.status}.` }
    const contentType = response.headers.get('content-type') || ''
    if (!/html|text/i.test(contentType)) return { text: '', fetched: false, reason: 'Public page was not readable text/HTML.' }
    const raw = (await response.text()).slice(0, 350000)
    const text = htmlToText(raw).slice(0, 30000)
    return { text: text.length >= 250 ? text : '', fetched: text.length >= 250, reason: text.length >= 250 ? '' : 'Too little public page text was extractable.' }
  } catch (error) {
    return { text: '', fetched: false, reason: error instanceof Error ? error.message : 'Public page fetch failed.' }
  } finally { clearTimeout(timeout) }
}

const bulletSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
    sourceEvidence: { type: 'string' },
    rationale: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' }, maxItems: 8 },
  },
  required: ['id', 'text', 'sourceEvidence', 'rationale', 'keywords'],
  additionalProperties: false,
}

const draftSchema = {
  type: 'object',
  properties: {
    projectedAlignment: { type: 'integer', minimum: 0, maximum: 100 },
    sections: {
      type: 'array', maxItems: 10,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, title: { type: 'string' },
          blocks: {
            type: 'array', maxItems: 18,
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' }, heading: { type: 'string' }, subheading: { type: 'string' }, meta: { type: 'string' }, sourceEvidence: { type: 'string' },
                bullets: { type: 'array', items: bulletSchema, maxItems: 10 },
              },
              required: ['id', 'heading', 'subheading', 'meta', 'sourceEvidence', 'bullets'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'title', 'blocks'], additionalProperties: false,
      },
    },
    targetedKeywords: { type: 'array', items: { type: 'string' }, maxItems: 24 },
    retainedGaps: { type: 'array', items: { type: 'string' }, maxItems: 15 },
    omittedContent: {
      type: 'array', maxItems: 15,
      items: { type: 'object', properties: { item: { type: 'string' }, reason: { type: 'string' } }, required: ['item', 'reason'], additionalProperties: false },
    },
    changeSummary: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    warnings: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  },
  required: ['projectedAlignment', 'sections', 'targetedKeywords', 'retainedGaps', 'omittedContent', 'changeSummary', 'warnings'],
  additionalProperties: false,
}

function formatGuidance(format: CvTailoringFormat) {
  if (format === 'Concise resume · 1 page') return 'Be highly selective. Prioritize the strongest job-relevant education, research, experience, skills, and at most a small number of publications/leadership items.'
  if (format === 'Academic CV · full') return 'Retain broader scholarly detail, publications, research, presentations, technical skills, and leadership while reordering for relevance. Do not force a page limit.'
  return 'Target an industry-oriented approximately two-page CV/resume. Prioritize relevant HEOR/RWE research, quantitative skills, evidence generation, publications, and transferable professional experience; de-emphasize unrelated academic or generic data-science content.'
}

function buildPrompt(job: Job, cvText: string, candidate: CandidateProfile, analysis: GptAnalysis, settings: TailoringSettings, publicPage: { text: string; fetched: boolean; reason: string }) {
  return `Create a job-specific CV draft from the candidate's MASTER CV. This is a factual transformation task, not creative writing.

NON-NEGOTIABLE FACT LOCK
- NEVER invent a skill, software package, method, therapeutic area, employer, title, project, publication, date, degree, metric, patient count, dollar amount, percentage, award, responsibility, or outcome.
- Every factual block and every bullet MUST include sourceEvidence that is an EXACT CONTIGUOUS excerpt copied from the MASTER CV text below. The server will reject claims whose evidence cannot be found.
- Use the SHORTEST exact evidence excerpt that is sufficient to verify the claim. Avoid copying whole paragraphs or entire sections into sourceEvidence.
- Rephrase and reorder supported facts to match the job's terminology when semantically faithful. Do not claim direct experience when the CV only supports adjacent/transferable experience.
- If the job requires something not supported by the CV, keep it in retainedGaps. NEVER add it to the CV.
- Do not include a fake objective such as "seeking" unless the source CV supports it. A concise professional/research summary is allowed only when every factual sentence is supported by evidence-linked bullets.
- Copy organization names, degrees, titles, and dates faithfully. For block heading, subheading, and meta fields, use exact contiguous wording from the MASTER CV whenever those fields are non-empty; the server will validate them. Do not upgrade "PhD Scholar" to "PhD" or imply graduation has occurred.
- Do not create new publications, abstracts, conferences, or authorship claims.
- Do not call projectedAlignment an ATS score.

FORMAT
${formatGuidance(settings.format)}
Emphasis: ${settings.emphasis}. This controls ordering and emphasis only; facts remain fixed.

PHASE 2 JOB ANALYSIS
Recommendation: ${analysis.recommendation}
Eligibility: ${analysis.eligibility}
Sponsorship: ${analysis.sponsorship}
Current GPT CV match: ${analysis.cvMatch}%
Overall fit: ${analysis.overallFit}%
HEOR relevance: ${analysis.heorRelevance}
Summary: ${cleanInput(analysis.summary, 3000)}
Required qualifications: ${(analysis.requiredQualifications || []).join(' | ')}
Preferred qualifications: ${(analysis.preferredQualifications || []).join(' | ')}
Supported strengths: ${(analysis.strengths || []).join(' | ')}
Known gaps: ${(analysis.gaps || []).join(' | ')}
Priority job keywords: ${(analysis.atsKeywords || []).join(' | ')}
Suggested tailoring actions: ${(analysis.tailoringActions || []).join(' | ')}
Cautions: ${(analysis.cautionFlags || []).join(' | ')}

JOB
Title: ${cleanInput(job.title, 500)}
Company: ${cleanInput(job.company, 500)}
Location: ${cleanInput(job.location, 500)}
Category: ${cleanInput(job.category, 100)}
Degree signal: ${cleanInput(job.degreeSignal, 1000)}
Public URL: ${cleanInput(job.applyUrl, 2000)}
Discovery description: ${cleanInput(job.description, 8000)}
Highlights: ${(job.highlights || []).join(', ')}
Public page fetch: ${publicPage.fetched ? 'Succeeded' : 'Unavailable'}${publicPage.reason ? ` (${publicPage.reason})` : ''}
Public page text: ${cleanInput(publicPage.text, 30000) || '[No additional public page text available]'}

CANDIDATE CONTEXT
Expected graduation: ${candidate.expectedGraduation}
Current status: ${candidate.currentStatus}
CPT eligible: ${candidate.cptEligible ? 'Yes' : 'No'}
Needs future sponsorship: ${candidate.needsFutureSponsorship ? 'Yes' : 'No'}
Open to relocation: ${candidate.openToRelocation ? 'Yes' : 'No'}
Notes: ${cleanInput(candidate.notes, 1500) || 'None'}

MASTER CV — ONLY FACTUAL SOURCE FOR CANDIDATE CLAIMS
${cleanInput(cvText, 70000)}

OUTPUT RULES
- Build clear CV sections. Section titles may be organizational labels such as EDUCATION, RELEVANT EXPERIENCE, RESEARCH EXPERIENCE, HEOR & TECHNICAL SKILLS, SELECTED PUBLICATIONS, LEADERSHIP.
- Each block should represent one source-supported education/experience/project/publication group. Its sourceEvidence must be an exact identifying excerpt from the MASTER CV.
- Each bullet must have an exact sourceEvidence excerpt supporting the rewritten bullet.
- rationale explains why the rewrite/reordering helps for this specific job.
- projectedAlignment is your estimated job–CV alignment after truthful tailoring, 0–100, not an ATS prediction.
- retainedGaps must explicitly preserve unsupported job requirements.
- omittedContent identifies material de-emphasized from the master CV and why.
- warnings should include any items the candidate must manually verify before submission.
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

function incompleteReason(payload: any) {
  return String(payload?.incomplete_details?.reason || payload?.status || 'unknown')
}

async function requestStructuredDraft(apiKey: string, prompt: string, depth: AnalysisDepth, maxOutputTokens: number) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-sol',
      reasoning: { effort: depth === 'Deep' ? 'high' : 'medium' },
      input: prompt,
      max_output_tokens: maxOutputTokens,
      store: false,
      text: { format: { type: 'json_schema', name: 'fact_locked_tailored_cv', strict: true, schema: draftSchema } },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API returned HTTP ${response.status}`)
  return payload
}

async function callOpenAI(apiKey: string, prompt: string, depth: AnalysisDepth) {
  const attempts = [
    { maxOutputTokens: 18000, compact: false },
    { maxOutputTokens: 26000, compact: true },
  ]
  let lastProblem = 'GPT did not return a complete structured CV draft.'

  for (const attempt of attempts) {
    const retryRules = attempt.compact ? `

IMPORTANT RETRY COMPACTNESS RULES
The previous generation was incomplete or malformed. Return a more selective draft while preserving the requested format. Use no more than 6 sections, no more than 10 total blocks, and no more than 4 bullets per block. Keep each sourceEvidence excerpt to the shortest exact contiguous excerpt that fully supports the claim. Keep rationales concise. Do not repeat the same evidence unless necessary.` : ''
    const payload = await requestStructuredDraft(apiKey, `${prompt}${retryRules}`, depth, attempt.maxOutputTokens)

    if (payload?.status === 'incomplete') {
      lastProblem = `GPT response was incomplete (${incompleteReason(payload)}).`
      continue
    }

    const raw = outputText(payload)
    if (!raw) {
      lastProblem = 'GPT returned no structured CV draft.'
      continue
    }

    try {
      return JSON.parse(raw)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON'
      lastProblem = `GPT returned malformed structured output (${message}).`
      continue
    }
  }

  throw new Error(`${lastProblem} Please retry once. If it repeats, choose Industry CV · 2 pages or Concise resume · 1 page to reduce output size.`)
}

function canonical(text: string) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
    // DOCX/PDF parsers and GPT may represent list bullets differently.
    // These are formatting artifacts, not factual content, so normalize them away.
    .replace(/[•◦▪▫■□●○◆◇►▸‣⁃·\u2022\uf0b7]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function lexicalCanonical(text: string) {
  return canonical(text)
    .replace(/[^a-z0-9+#./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function evidenceExists(evidence: string, cvCanonical: string, cvLexical: string) {
  const needle = canonical(evidence)
  if (needle.length < 2) return false
  if (cvCanonical.includes(needle)) return true

  const lexicalNeedle = lexicalCanonical(evidence)
  if (!lexicalNeedle) return false

  // Formatting-tolerant exact phrase check. This still requires the candidate's
  // evidence words to appear contiguously after punctuation/bullet normalization.
  if (cvLexical.includes(lexicalNeedle)) return true

  // Short skill names such as R, SAS, SQL, SPSS, HTA, DCE can be valid evidence
  // even when Word list formatting differs. Require a token-boundary match.
  if (lexicalNeedle.length <= 12 && !lexicalNeedle.includes(' ')) {
    const escaped = lexicalNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(cvLexical)
  }

  return false
}

function applyFactLock(draft: any, cvText: string) {
  const cvCanonical = canonical(cvText)
  const cvLexical = lexicalCanonical(cvText)
  const rejected: string[] = []
  let verified = 0

  const sections = (draft.sections || []).map((section: any) => {
    const blocks = (section.blocks || []).flatMap((block: any) => {
      const factualBlockFields = [block.heading, block.subheading, block.meta].filter((value: string) => String(value || '').trim())
      const blockFieldsSupported = factualBlockFields.every((value: string) => evidenceExists(value, cvCanonical, cvLexical))
      if (!evidenceExists(block.sourceEvidence, cvCanonical, cvLexical) || !blockFieldsSupported) {
        rejected.push(`Block rejected: ${block.heading || block.subheading || section.title}`)
        return []
      }
      verified += 1 + factualBlockFields.length
      const bullets = (block.bullets || []).flatMap((bullet: any) => {
        if (!evidenceExists(bullet.sourceEvidence, cvCanonical, cvLexical)) {
          rejected.push(`Claim rejected: ${bullet.text}`)
          return []
        }
        verified += 1
        return [bullet]
      })
      if (!bullets.length && !block.heading && !block.subheading && !block.meta) return []
      return [{ ...block, bullets }]
    })
    return { ...section, blocks }
  }).filter((section: any) => section.blocks.length > 0)

  const penalty = Math.min(20, rejected.length * 3)
  return {
    ...draft,
    projectedAlignment: Math.max(0, Math.min(100, Number(draft.projectedAlignment || 0) - penalty)),
    sections,
    factLock: {
      passed: rejected.length === 0,
      verifiedClaims: verified,
      rejectedClaims: rejected.slice(0, 20),
      notes: [
        'Each generated block and bullet required a source-evidence excerpt found in the uploaded master CV.',
        'Unsupported job requirements remain gaps instead of being inserted as candidate experience.',
        'Manual edits made after generation are not automatically re-verified by the server.',
      ],
    },
  }
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
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) return Response.json({ error: 'This account is not authorized to generate tailored CVs.' }, { status: 403, headers: corsHeaders })

    const body = await req.json().catch(() => ({}))
    const job = body?.job as Job
    const cvText = cleanInput(body?.cv?.text, 80000)
    const candidate = body?.candidate as CandidateProfile
    const analysis = body?.analysis as GptAnalysis
    const settings = body?.settings as TailoringSettings
    const depth: AnalysisDepth = body?.depth === 'Standard' ? 'Standard' : 'Deep'

    if (!job?.id || !job?.title || !job?.applyUrl) return Response.json({ error: 'A valid analyzed job is required.' }, { status: 400, headers: corsHeaders })
    if (cvText.length < 100) return Response.json({ error: 'Upload a readable master CV before tailoring.' }, { status: 400, headers: corsHeaders })
    if (!analysis?.recommendation || typeof analysis.cvMatch !== 'number') return Response.json({ error: 'Run Phase 2 GPT analysis before tailoring this job.' }, { status: 400, headers: corsHeaders })
    if (!settings?.format || !settings?.emphasis) return Response.json({ error: 'Tailoring settings are required.' }, { status: 400, headers: corsHeaders })

    const publicPage = await fetchPublicJobPage(job.applyUrl)
    const prompt = buildPrompt(job, cvText, candidate, analysis, settings, publicPage)
    const parsed = await callOpenAI(openaiKey, prompt, depth)
    const locked = applyFactLock(parsed, cvText)

    const tailoredCv = {
      ...locked,
      jobId: job.id,
      generatedAt: new Date().toISOString(),
      model: 'gpt-5.6-sol',
      format: settings.format,
      emphasis: settings.emphasis,
      manuallyEdited: false,
    }

    if (!tailoredCv.sections.length) throw new Error('Fact lock rejected the generated CV content. Regenerate or use a more complete master CV.')

    if (secretKey) {
      try {
        const admin = createClient(supabaseUrl, secretKey)
        await admin.from('cv_versions').insert({
          user_id: user.id,
          job_id: job.id,
          source_cv_name: cleanInput(body?.cv?.fileName, 500),
          format: settings.format,
          emphasis: settings.emphasis,
          model: tailoredCv.model,
          projected_alignment: tailoredCv.projectedAlignment,
          fact_lock_passed: tailoredCv.factLock.passed,
          document: tailoredCv,
        })
      } catch (persistError) {
        console.warn('Tailored CV succeeded, persistence skipped:', persistError)
      }
    }

    return Response.json({ tailoredCv }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error instanceof Error ? error.message : 'Unexpected CV tailoring error' }, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
