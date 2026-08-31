import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx'
import type { CvProfile, Job, TailoredCvDocument } from '../types'

function nonEmptyLines(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export function cvHeaderLines(cv: CvProfile) {
  const lines = nonEmptyLines(cv.text)
  const name = lines[0] || 'Candidate'
  const contact = lines[1] || ''
  return { name, contact }
}

export function tailoredCvToPlainText(document: TailoredCvDocument, cv: CvProfile) {
  const header = cvHeaderLines(cv)
  const lines: string[] = [header.name]
  if (header.contact) lines.push(header.contact)
  lines.push('')

  for (const section of document.sections) {
    lines.push(section.title.toUpperCase())
    for (const block of section.blocks) {
      if (block.heading) lines.push(block.heading)
      if (block.subheading || block.meta) lines.push([block.subheading, block.meta].filter(Boolean).join(' | '))
      for (const bullet of block.bullets) lines.push(`• ${bullet.text}`)
      lines.push('')
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 90) || 'tailored_cv'
}

export async function downloadTailoredCvDocx(document: TailoredCvDocument, cv: CvProfile, job: Job) {
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
      spacing: { after: 150 },
      children: [new TextRun({ text: header.contact, size: 18, font: 'Arial' })],
    }))
  }

  for (const section of document.sections) {
    children.push(new Paragraph({
      spacing: { before: 110, after: 45 },
      border: { bottom: { color: 'AEB7C5', size: 5, style: BorderStyle.SINGLE, space: 2 } },
      children: [new TextRun({ text: section.title.toUpperCase(), bold: true, size: 20, font: 'Arial' })],
    }))

    for (const block of section.blocks) {
      if (block.heading) {
        children.push(new Paragraph({
          spacing: { before: 55, after: 15 },
          children: [new TextRun({ text: block.heading, bold: true, size: 19, font: 'Arial' })],
        }))
      }
      const meta = [block.subheading, block.meta].filter(Boolean).join(' | ')
      if (meta) {
        children.push(new Paragraph({
          spacing: { after: 25 },
          children: [new TextRun({ text: meta, italics: true, size: 18, font: 'Arial' })],
        }))
      }
      for (const bullet of block.bullets) {
        children.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 35, line: 235 },
          children: [new TextRun({ text: bullet.text, size: 18, font: 'Arial' })],
        }))
      }
    }
  }

  const wordDocument = new Document({
    sections: [{
      properties: { page: { margin: { top: 540, right: 650, bottom: 540, left: 650 } } },
      children,
    }],
  })

  const blob = await Packer.toBlob(wordDocument)
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  a.download = `${safeFileName(job.company)}_${safeFileName(job.title)}_Tailored_CV.docx`
  window.document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadTailoringAudit(document: TailoredCvDocument, job: Job) {
  const payload = JSON.stringify({ job: { title: job.title, company: job.company, url: job.applyUrl }, tailoredCv: document }, null, 2)
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  a.download = `${safeFileName(job.company)}_${safeFileName(job.title)}_CV_Audit.json`
  window.document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
