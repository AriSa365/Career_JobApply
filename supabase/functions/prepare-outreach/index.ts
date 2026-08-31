import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_AI_MODEL = 'gpt-5.6-luna'
const DEEP_REVIEW_MODEL = 'gpt-5.6-sol'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AnalysisDepth = 'Standard' | 'Deep'
type ContactRoleCategory = 'RECRUITER' | 'HIRING_MANAGER' | 'HEOR_RWE_LEADER' | 'OTHER'

type Job = { id: string; title: string; company: string; location: string; category: string; description: string; applyUrl: string }
type ApplicationRecord = { id: string; jobId: string; job: Job; status: string }
type CandidateProfile = { expectedGraduation: string; currentStatus: string; cptEligible: boolean; needsFutureSponsorship: boolean; openToRelocation: boolean; notes: string }
type GptAnalysis = { recommendation: string; eligibility: string; sponsorship: string; cvMatch: number; overallFit: number; heorRelevance: string; summary: string; strengths: string[]; gaps: string[]; atsKeywords: string[]; cautionFlags: string[] }
type NetworkingContact = {
  id: string; applicationId: string; jobId: string; name: string; title: string; company: string; location: string;
  linkedinUrl: string; sourceUrl: string; sourceSnippet: string; publicEmail: string; roleCategory: ContactRoleCategory;
  relevanceScore: number; relevanceReasons: string[]
}

type CvProfile = { fileName: string; text: string }

function modelForDepth(depth: AnalysisDepth) { return depth === 'Deep' ? DEEP_REVIEW_MODEL : DEFAULT_AI_MODEL }

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

function clean(value: unknown, max = 30000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max)
}

function canonical(text: string) {
  return String(text || '')
    .normalize('NFKC').toLowerCase()
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
  if (lexicalNeedle.length <= 14 && !lexicalNeedle.includes(' ')) {
    const escaped = lexicalNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(cvLexical)
  }
  return false
}

const evidenceArray = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 }
const outreachSchema = {
  type: 'object',
  properties: {
    linkedinConnectionNote: { type: 'object', properties: { text: { type: 'string', maxLength: 280 }, sourceEvidence: evidenceArray }, required: ['text', 'sourceEvidence'], additionalProperties: false },
    linkedinFollowUp: { type: 'object', properties: { text: { type: 'string', maxLength: 900 }, sourceEvidence: evidenceArray }, required: ['text', 'sourceEvidence'], additionalProperties: false },
    emailSubject: { type: 'string', maxLength: 140 },
    emailBody: { type: 'object', properties: { text: { type: 'string', maxLength: 2400 }, sourceEvidence: evidenceArray }, required: ['text', 'sourceEvidence'], additionalProperties: false },
    personalizationPoints: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
    cautions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
  },
  required: ['linkedinConnectionNote', 'linkedinFollowUp', 'emailSubject', 'emailBody', 'personalizationPoints', 'cautions'],
  additionalProperties: false,
}

function buildPrompt(application: ApplicationRecord, analysis: GptAnalysis, contact: NetworkingContact, cv: CvProfile, candidate: CandidateProfile) {
  return `Draft truthful, concise networking outreach for one job application and one publicly discovered professional contact.

GOAL
Create a LinkedIn connection note, a LinkedIn follow-up message, and a professional recruiter/networking email. The candidate will review and personally send them.

FACT LOCK — NON-NEGOTIABLE
- Candidate claims must be supported by the MASTER CV below.
- Every LinkedIn message and email body must include 1–3 sourceEvidence strings copied exactly from the MASTER CV. Use the shortest exact evidence sufficient to support the candidate claims.
- Never invent skills, publications, degrees, employers, achievements, therapeutic areas, or methods.
- The candidate profile may be used for expected graduation/work-authorization context, but do NOT bring up visa sponsorship or CPT in cold outreach unless the message is specifically about work authorization. This outreach is for relationship-building, not immigration negotiation.
- Do not imply that this contact is the actual hiring manager unless the supplied public title explicitly proves it. Use neutral wording such as "your work at COMPANY" or "the team".
- Do not claim the contact referred the candidate, reviewed the application, or is responsible for hiring.
- Do not over-flatter. Keep wording specific, professional, and natural.
- LinkedIn connection note must be <=280 characters.
- LinkedIn follow-up should normally be 350–700 characters.
- Email should normally be 100–180 words, with a short subject line.
- If the Phase 2 recommendation is SKIP or eligibility FAIL, include a caution that outreach should be informational rather than application-advocacy unless the candidate has explicitly overridden eligibility elsewhere.

JOB / APPLICATION
Title: ${clean(application.job.title, 500)}
Company: ${clean(application.job.company, 300)}
Location: ${clean(application.job.location, 300)}
Category: ${clean(application.job.category, 120)}
Application status: ${clean(application.status, 100)}
Job description/snippet: ${clean(application.job.description, 7000)}
Application URL: ${clean(application.job.applyUrl, 1500)}

PHASE 2 ANALYSIS
Recommendation: ${analysis.recommendation}
Eligibility: ${analysis.eligibility}
Sponsorship: ${analysis.sponsorship}
CV match: ${analysis.cvMatch}%
Overall fit: ${analysis.overallFit}%
HEOR relevance: ${analysis.heorRelevance}
Summary: ${clean(analysis.summary, 3000)}
Strengths: ${(analysis.strengths || []).join(' | ')}
Gaps: ${(analysis.gaps || []).join(' | ')}
Priority keywords: ${(analysis.atsKeywords || []).join(' | ')}
Cautions: ${(analysis.cautionFlags || []).join(' | ')}

PUBLIC CONTACT EVIDENCE
Name: ${clean(contact.name, 200)}
Title: ${clean(contact.title, 500)}
Company: ${clean(contact.company, 300)}
Role category: ${contact.roleCategory}
Relevance score: ${contact.relevanceScore}
Why surfaced: ${(contact.relevanceReasons || []).join(' | ')}
Public snippet: ${clean(contact.sourceSnippet, 2500)}
LinkedIn URL: ${clean(contact.linkedinUrl, 1200)}

CANDIDATE PROFILE — contextual only
Expected graduation: ${clean(candidate.expectedGraduation, 100)}
Current status: ${clean(candidate.currentStatus, 400)}

MASTER CV — factual source for candidate claims
${clean(cv.text, 60000)}

Return the required structured outreach. Personalize around the role, the contact's public role, and the candidate's strongest supported HEOR/RWE/quantitative evidence. Avoid generic "I was impressed by your profile" language.`
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

async function callOpenAI(apiKey: string, prompt: string, depth: AnalysisDepth) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelForDepth(depth),
      reasoning: { effort: depth === 'Deep' ? 'high' : 'medium' },
      input: prompt,
      max_output_tokens: 5000,
      store: false,
      text: { format: { type: 'json_schema', name: 'career_outreach_package', strict: true, schema: outreachSchema } },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI returned HTTP ${response.status}`)
  const text = outputText(payload)
  if (!text) throw new Error('OpenAI returned no outreach text.')
  return { payload, parsed: JSON.parse(text) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const publishableKey = namedEnvKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const allowedEmail = Deno.env.get('ALLOWED_EMAIL')?.toLowerCase()
    const authorization = req.headers.get('Authorization')
    if (!supabaseUrl || !publishableKey || !authorization) return Response.json({ error: 'Supabase authentication is not configured.' }, { status: 500, headers: corsHeaders })
    if (!openAiKey) return Response.json({ error: 'OPENAI_API_KEY is missing from Edge Function secrets.' }, { status: 500, headers: corsHeaders })

    const client = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } })
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await client.auth.getUser(token)
    if (userError || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: corsHeaders })
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail) return Response.json({ error: 'This account is not authorized.' }, { status: 403, headers: corsHeaders })

    const body = await req.json().catch(() => ({}))
    const application = body?.application as ApplicationRecord | undefined
    const analysis = body?.analysis as GptAnalysis | undefined
    const contact = body?.contact as NetworkingContact | undefined
    const cv = body?.cv as CvProfile | undefined
    const candidate = body?.candidate as CandidateProfile | undefined
    const depth: AnalysisDepth = body?.depth === 'Deep' ? 'Deep' : 'Standard'

    if (!application?.job?.id || !analysis || !contact?.id || !cv?.text || !candidate) {
      return Response.json({ error: 'Application, Phase 2 analysis, contact, candidate profile, and master CV are required.' }, { status: 400, headers: corsHeaders })
    }

    const { payload, parsed } = await callOpenAI(openAiKey, buildPrompt(application, analysis, contact, cv, candidate), depth)
    const cvCanonical = canonical(cv.text)
    const cvLexical = lexicalCanonical(cv.text)
    const rejectedItems: string[] = []
    let verifiedEvidence = 0

    for (const field of [parsed.linkedinConnectionNote, parsed.linkedinFollowUp, parsed.emailBody]) {
      const valid: string[] = []
      for (const evidence of field.sourceEvidence || []) {
        if (evidenceExists(String(evidence), cvCanonical, cvLexical)) { valid.push(String(evidence)); verifiedEvidence += 1 }
        else rejectedItems.push(String(evidence))
      }
      field.sourceEvidence = valid
    }

    const factLockPassed = rejectedItems.length === 0 && verifiedEvidence >= 3
    if (!factLockPassed) {
      parsed.cautions = Array.from(new Set([...(parsed.cautions || []), 'Fact-lock review required before sending: at least one candidate-evidence excerpt could not be verified exactly against the master CV.']))
    }

    const outreach = {
      id: crypto.randomUUID(),
      applicationId: application.id,
      jobId: application.jobId,
      contactId: contact.id,
      generatedAt: new Date().toISOString(),
      model: modelForDepth(depth),
      linkedinConnectionNote: parsed.linkedinConnectionNote.text.trim().slice(0, 280),
      linkedinFollowUp: parsed.linkedinFollowUp.text.trim(),
      emailSubject: parsed.emailSubject.trim(),
      emailBody: parsed.emailBody.text.trim(),
      personalizationPoints: parsed.personalizationPoints || [],
      cautions: parsed.cautions || [],
      factLock: { passed: factLockPassed, verifiedEvidence, rejectedItems },
      status: 'Draft',
      sentAt: '',
      followUpAt: '',
    }

    return Response.json({
      outreach,
      usage: {
        inputTokens: payload?.usage?.input_tokens,
        outputTokens: payload?.usage?.output_tokens,
        totalTokens: payload?.usage?.total_tokens,
      },
    }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('prepare-outreach error', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Outreach generation failed.' }, { status: 500, headers: corsHeaders })
  }
})
