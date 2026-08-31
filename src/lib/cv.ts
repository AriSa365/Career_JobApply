import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CvMatch, CvProfile, Job } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const TERM_LIBRARY: Array<{ label: string; aliases: string[]; weight: number }> = [
  { label: 'HEOR', aliases: ['heor', 'health economics', 'outcomes research'], weight: 3 },
  { label: 'Real-world evidence', aliases: ['real world evidence', 'real-world evidence', 'rwe'], weight: 3 },
  { label: 'Real-world data', aliases: ['real world data', 'real-world data', 'rwd'], weight: 2 },
  { label: 'Epidemiology', aliases: ['epidemiology', 'epidemiologic'], weight: 2 },
  { label: 'Pharmacoepidemiology', aliases: ['pharmacoepidemiology', 'pharmacoepidemiologic'], weight: 3 },
  { label: 'Market access', aliases: ['market access', 'value & access', 'value and access'], weight: 3 },
  { label: 'Payer research', aliases: ['payer', 'reimbursement'], weight: 2 },
  { label: 'Patient-reported outcomes', aliases: ['patient reported outcomes', 'patient-reported outcomes', 'pro '], weight: 3 },
  { label: 'Patient preference', aliases: ['patient preference', 'preference research'], weight: 3 },
  { label: 'Discrete choice experiment', aliases: ['discrete choice experiment', 'dce'], weight: 3 },
  { label: 'Best-worst scaling', aliases: ['best-worst scaling', 'best worst scaling', 'bws'], weight: 3 },
  { label: 'Economic modeling', aliases: ['economic modeling', 'economic modelling', 'economic model'], weight: 3 },
  { label: 'Cost-effectiveness', aliases: ['cost effectiveness', 'cost-effectiveness', 'cost utility', 'cost-utility'], weight: 3 },
  { label: 'Budget impact', aliases: ['budget impact'], weight: 3 },
  { label: 'HTA', aliases: ['health technology assessment', 'hta'], weight: 2 },
  { label: 'Systematic literature review', aliases: ['systematic literature review', 'systematic review'], weight: 3 },
  { label: 'Meta-analysis', aliases: ['meta-analysis', 'meta analysis'], weight: 3 },
  { label: 'Evidence synthesis', aliases: ['evidence synthesis', 'evidence generation', 'evidence gap'], weight: 2 },
  { label: 'Observational research', aliases: ['observational study', 'observational research', 'retrospective study'], weight: 2 },
  { label: 'R', aliases: ['r programming', ' r ', ' r,', ' r.'], weight: 2 },
  { label: 'SAS', aliases: ['sas'], weight: 2 },
  { label: 'Python', aliases: ['python'], weight: 2 },
  { label: 'SQL', aliases: ['sql'], weight: 2 },
  { label: 'Stata', aliases: ['stata'], weight: 2 },
  { label: 'TreeAge', aliases: ['treeage'], weight: 2 },
  { label: 'Excel', aliases: ['excel'], weight: 1 },
  { label: 'Scientific writing', aliases: ['scientific writing', 'manuscript', 'publication', 'abstract', 'poster'], weight: 2 },
  { label: 'Cross-functional collaboration', aliases: ['cross-functional', 'cross functional', 'stakeholder'], weight: 1 },
]

function clean(text: string) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+&./-]+/g, ' ').replace(/\s+/g, ' ').trim()} `
}

function containsAlias(haystack: string, aliases: string[]) {
  return aliases.some((alias) => haystack.includes(clean(alias)))
}

export async function extractCv(file: File): Promise<CvProfile> {
  const name = file.name.toLowerCase()
  let text = ''

  if (name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    text = result.value
  } else if (name.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item: any) => item?.str || '').join(' '))
    }
    text = pages.join('\n')
  } else if (name.endsWith('.txt')) {
    text = await file.text()
  } else {
    throw new Error('Please upload a DOCX, PDF, or TXT CV.')
  }

  text = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (text.length < 80) throw new Error('Very little text could be extracted from this CV. Try a DOCX version or a text-based PDF.')

  return {
    fileName: file.name,
    text,
    uploadedAt: new Date().toISOString(),
    wordCount: text.split(/\s+/).filter(Boolean).length,
  }
}

export function calculateCvMatch(job: Job, cv: CvProfile, customKeywords: string[]): CvMatch {
  const jobText = clean([job.title, job.description, job.highlights.join(' '), job.degreeSignal, job.category].join(' '))
  const cvText = clean(cv.text)

  const relevantTerms = TERM_LIBRARY.filter((term) => containsAlias(jobText, term.aliases))
  const customTerms = Array.from(new Set(customKeywords.map((x) => x.trim()).filter(Boolean)))
    .filter((term) => jobText.includes(clean(term)))
    .map((term) => ({ label: term, aliases: [term], weight: 2 }))

  const combined = [...relevantTerms]
  for (const term of customTerms) {
    if (!combined.some((existing) => existing.label.toLowerCase() === term.label.toLowerCase())) combined.push(term)
  }

  // Search snippets can be thin. Add the primary category as a low-weight requirement when needed.
  if (combined.length < 3 && job.category !== 'Other') {
    const fallback = TERM_LIBRARY.find((x) => x.label === (job.category === 'HEOR' ? 'HEOR' : job.category === 'Market Access' ? 'Market access' : job.category === 'Patient-Centered' ? 'Patient preference' : 'Real-world evidence'))
    if (fallback && !combined.includes(fallback)) combined.push(fallback)
  }

  const totalWeight = combined.reduce((sum, term) => sum + term.weight, 0) || 1
  const matched = combined.filter((term) => containsAlias(cvText, term.aliases))
  const matchedWeight = matched.reduce((sum, term) => sum + term.weight, 0)

  let score = Math.round((matchedWeight / totalWeight) * 82)

  const degreeRequested = /ph\.?d|doctoral|doctorate|graduate/i.test(job.degreeSignal)
  if (!degreeRequested || /ph\.?d|doctoral|doctorate|graduate/i.test(cvText)) score += 8

  const researchEvidence = /research|publication|manuscript|poster|conference|project/i.test(cvText)
  if (researchEvidence) score += 5

  const quantitativeEvidence = /statistical|analysis|model|regression|data|python|sas|sql|\br\b/i.test(cvText)
  if (quantitativeEvidence) score += 5

  score = Math.min(98, Math.max(0, score))

  const confidence: CvMatch['confidence'] = job.needsVerification || job.description.length < 500 ? 'Preliminary' : 'Strong'
  return {
    score,
    confidence,
    matchedKeywords: matched.map((x) => x.label).slice(0, 8),
    missingKeywords: combined.filter((term) => !matched.includes(term)).map((x) => x.label).slice(0, 8),
    evidenceCount: combined.length,
  }
}
