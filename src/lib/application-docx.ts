import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'
import type { ApplicationPackage, CvProfile, Job } from '../types'
import { cvHeaderLines } from './docx'

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 90) || 'application'
}

export async function downloadCoverLetterDocx(pkg: ApplicationPackage, cv: CvProfile, job: Job) {
  const header = cvHeaderLines(cv)
  const children: Paragraph[] = []

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 70 },
    children: [new TextRun({ text: header.name, bold: true, size: 28, font: 'Arial' })],
  }))
  if (header.contact) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [new TextRun({ text: header.contact, size: 18, font: 'Arial' })],
    }))
  }

  if (pkg.coverLetter.greeting) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: pkg.coverLetter.greeting, size: 20, font: 'Arial' })] }))
  }
  for (const paragraph of pkg.coverLetter.paragraphs) {
    children.push(new Paragraph({
      spacing: { after: 130, line: 260 },
      children: [new TextRun({ text: paragraph.text, size: 20, font: 'Arial' })],
    }))
  }
  if (pkg.coverLetter.closing) {
    children.push(new Paragraph({ spacing: { before: 80, after: 35 }, children: [new TextRun({ text: pkg.coverLetter.closing, size: 20, font: 'Arial' })] }))
    children.push(new Paragraph({ children: [new TextRun({ text: header.name, size: 20, font: 'Arial' })] }))
  }

  const wordDocument = new Document({
    sections: [{ properties: { page: { margin: { top: 720, right: 820, bottom: 720, left: 820 } } }, children }],
  })
  const blob = await Packer.toBlob(wordDocument)
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  a.download = `${safeFileName(job.company)}_${safeFileName(job.title)}_Cover_Letter.docx`
  window.document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function applicationPackageToPlainText(pkg: ApplicationPackage) {
  const lines: string[] = []
  lines.push(pkg.coverLetter.greeting)
  lines.push('')
  for (const paragraph of pkg.coverLetter.paragraphs) {
    lines.push(paragraph.text)
    lines.push('')
  }
  lines.push(pkg.coverLetter.closing)
  lines.push('')
  lines.push('APPLICATION ANSWERS')
  for (const answer of pkg.answers) {
    lines.push(`Q: ${answer.question}`)
    lines.push(`A: ${answer.answer}`)
    if (answer.warning) lines.push(`Review: ${answer.warning}`)
    lines.push('')
  }
  lines.push('WORK AUTHORIZATION GUIDANCE')
  lines.push(`Current authorization: ${pkg.authorizationGuidance.currentAuthorization}`)
  lines.push(`Future sponsorship: ${pkg.authorizationGuidance.futureSponsorship}`)
  lines.push(`Relocation: ${pkg.authorizationGuidance.relocation}`)
  for (const caution of pkg.authorizationGuidance.cautions) lines.push(`- ${caution}`)
  lines.push('')
  lines.push('SUBMISSION CHECKLIST')
  for (const item of pkg.submissionChecklist) lines.push(`- ${item}`)
  return lines.join('\n').trim()
}
