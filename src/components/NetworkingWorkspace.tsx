import { useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import {
  AlertTriangle, Check, Copy, ExternalLink, Linkedin, Mail, RefreshCw, Search,
  Send, Sparkles, UserRoundSearch, UsersRound,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  AnalysisDepth, ApplicationRecord, CandidateProfile, ContactDiscoveryResponse, ContactStatus, CvProfile,
  GptAnalysis, NetworkingContact, OutreachDraft, PrepareOutreachResponse,
} from '../types'

type Props = {
  applications: Map<string, ApplicationRecord>
  analyses: Map<string, GptAnalysis>
  cv: CvProfile | null
  candidate: CandidateProfile
  depth: AnalysisDepth
}

function rowToContact(row: any): NetworkingContact {
  return {
    id: String(row.id), applicationId: String(row.application_id || ''), jobId: String(row.job_id || ''),
    name: row.name || '', title: row.title || '', company: row.company || '', location: row.location || '',
    linkedinUrl: row.linkedin_url || '', sourceUrl: row.source_url || '', sourceSnippet: row.source_snippet || '',
    publicEmail: row.public_email || '', roleCategory: row.role_category || 'OTHER', relevanceScore: Number(row.relevance_score || 0),
    relevanceReasons: Array.isArray(row.relevance_reasons) ? row.relevance_reasons : [], discoveryQuery: row.discovery_query || '',
    status: row.status || 'Discovered', followUpAt: row.follow_up_at || '', notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(), updatedAt: row.updated_at || new Date().toISOString(),
  }
}

function rowToOutreach(row: any): OutreachDraft {
  return {
    id: String(row.id), applicationId: String(row.application_id || ''), jobId: String(row.job_id || ''), contactId: String(row.contact_id || ''),
    generatedAt: row.created_at || new Date().toISOString(), model: row.model || '',
    linkedinConnectionNote: row.linkedin_connection_note || '', linkedinFollowUp: row.linkedin_follow_up || '',
    emailSubject: row.email_subject || '', emailBody: row.email_body || '',
    personalizationPoints: Array.isArray(row.personalization_points) ? row.personalization_points : [], cautions: [],
    factLock: { passed: Boolean(row.fact_lock_passed), verifiedEvidence: Number(row.verified_evidence || 0), rejectedItems: Array.isArray(row.rejected_items) ? row.rejected_items : [] },
    status: row.status || 'Draft', sentAt: row.sent_at || '', followUpAt: row.follow_up_at || '',
  }
}

async function readableFunctionError(err: unknown) {
  if (err instanceof FunctionsHttpError) {
    try { const payload = await err.context.json(); return payload?.error || err.message } catch { return err.message }
  }
  return err instanceof Error ? err.message : 'Unexpected error.'
}

function unresolvedCompany(application?: ApplicationRecord) {
  return !application?.job?.company || /company not parsed|unknown company|^unknown$/i.test(application.job.company)
}

function roleLabel(role: NetworkingContact['roleCategory']) {
  if (role === 'RECRUITER') return 'Recruiter / Talent'
  if (role === 'HEOR_RWE_LEADER') return 'HEOR / RWE leader'
  if (role === 'HIRING_MANAGER') return 'Management signal'
  return 'Other relevant contact'
}

function addDaysISO(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10)
}

export default function NetworkingWorkspace({ applications, analyses, cv, candidate, depth }: Props) {
  const applicationList = useMemo(() => Array.from(applications.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [applications])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [contacts, setContacts] = useState<Map<string, NetworkingContact>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, OutreachDraft>>(new Map())
  const [selectedContactId, setSelectedContactId] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [discoveryNote, setDiscoveryNote] = useState('')

  useEffect(() => {
    if (!selectedApplicationId && applicationList[0]?.id) setSelectedApplicationId(applicationList[0].id)
  }, [applicationList, selectedApplicationId])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    Promise.all([
      supabase.from('networking_contacts').select('*').order('relevance_score', { ascending: false }).limit(300),
      supabase.from('outreach_messages').select('*').order('created_at', { ascending: false }).limit(300),
    ]).then(([contactsResult, draftsResult]) => {
      if (cancelled) return
      if (!contactsResult.error && contactsResult.data) setContacts(new Map(contactsResult.data.map((row) => { const contact = rowToContact(row); return [contact.id, contact] })))
      if (!draftsResult.error && draftsResult.data) {
        const loaded = new Map<string, OutreachDraft>()
        for (const row of draftsResult.data) { const draft = rowToOutreach(row); if (!loaded.has(draft.contactId)) loaded.set(draft.contactId, draft) }
        setDrafts(loaded)
      }
    })
    return () => { cancelled = true }
  }, [])

  const application = applications.get(selectedApplicationId)
  const analysis = application ? analyses.get(application.jobId) : undefined
  const applicationContacts = useMemo(() => Array.from(contacts.values()).filter((c) => c.applicationId === selectedApplicationId).sort((a, b) => b.relevanceScore - a.relevanceScore), [contacts, selectedApplicationId])
  const selectedContact = contacts.get(selectedContactId) || applicationContacts[0]
  const selectedDraft = selectedContact ? drafts.get(selectedContact.id) : undefined

  useEffect(() => {
    if (applicationContacts.length && !applicationContacts.some((c) => c.id === selectedContactId)) setSelectedContactId(applicationContacts[0].id)
    if (!applicationContacts.length) setSelectedContactId('')
  }, [applicationContacts, selectedContactId])

  const recruiterCount = applicationContacts.filter((c) => c.roleCategory === 'RECRUITER').length
  const leaderCount = applicationContacts.filter((c) => c.roleCategory === 'HEOR_RWE_LEADER' || c.roleCategory === 'HIRING_MANAGER').length
  const contactedCount = applicationContacts.filter((c) => ['Contacted', 'Replied', 'Follow-up due', 'Closed'].includes(c.status)).length

  async function persistContact(contact: NetworkingContact) {
    if (!supabase) return
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return
    const payload = {
      id: contact.id, user_id: userId, application_id: contact.applicationId || null, job_id: contact.jobId,
      name: contact.name, title: contact.title, company: contact.company, location: contact.location,
      linkedin_url: contact.linkedinUrl, source_url: contact.sourceUrl, source_snippet: contact.sourceSnippet,
      public_email: contact.publicEmail, role_category: contact.roleCategory, relevance_score: contact.relevanceScore,
      relevance_reasons: contact.relevanceReasons, discovery_query: contact.discoveryQuery, status: contact.status,
      follow_up_at: contact.followUpAt || null, notes: contact.notes, created_at: contact.createdAt, updated_at: contact.updatedAt,
    }
    const { error: persistError } = await supabase.from('networking_contacts').upsert(payload, { onConflict: 'id' })
    if (persistError) setError(`Could not save contact: ${persistError.message}`)
  }

  async function persistDraft(draft: OutreachDraft) {
    if (!supabase) return
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return
    const { error: persistError } = await supabase.from('outreach_messages').upsert({
      id: draft.id, user_id: userId, application_id: draft.applicationId || null, job_id: draft.jobId, contact_id: draft.contactId,
      model: draft.model, linkedin_connection_note: draft.linkedinConnectionNote, linkedin_follow_up: draft.linkedinFollowUp,
      email_subject: draft.emailSubject, email_body: draft.emailBody, personalization_points: draft.personalizationPoints,
      fact_lock_passed: draft.factLock.passed, verified_evidence: draft.factLock.verifiedEvidence, rejected_items: draft.factLock.rejectedItems,
      status: draft.status, sent_at: draft.sentAt || null, follow_up_at: draft.followUpAt || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (persistError) setError(`Could not save outreach draft: ${persistError.message}`)
  }

  async function discoverContacts() {
    if (!supabase || !application) return
    if (unresolvedCompany(application)) { setError('Resolve the employer name in Applications before searching for recruiter contacts.'); return }
    setDiscovering(true); setError(''); setDiscoveryNote('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<ContactDiscoveryResponse>('find-contacts', { body: { application, analysis } })
      if (invokeError) throw invokeError
      const found = data?.contacts || []
      const next = new Map(contacts)
      for (const contact of found) {
        const existing = Array.from(next.values()).find((x) => x.jobId === contact.jobId && x.linkedinUrl === contact.linkedinUrl)
        const merged = existing ? { ...contact, id: existing.id, status: existing.status, followUpAt: existing.followUpAt, notes: existing.notes, publicEmail: existing.publicEmail || contact.publicEmail, createdAt: existing.createdAt, updatedAt: new Date().toISOString() } : contact
        next.set(merged.id, merged)
        await persistContact(merged)
      }
      setContacts(next)
      setDiscoveryNote(found.length ? `${found.length} public LinkedIn profile${found.length === 1 ? '' : 's'} found and ranked. These are likely relevant contacts, not confirmed hiring managers.` : 'No sufficiently relevant public LinkedIn profiles were found in this search.')
      if (data?.meta?.warnings?.length) setDiscoveryNote((x) => `${x} ${data.meta.warnings.join(' · ')}`)
    } catch (err) { setError(await readableFunctionError(err)) }
    finally { setDiscovering(false) }
  }

  function updateContact(patch: Partial<NetworkingContact>) {
    if (!selectedContact) return
    const updated = { ...selectedContact, ...patch, updatedAt: new Date().toISOString() }
    setContacts((current) => new Map(current).set(updated.id, updated))
    void persistContact(updated)
  }

  async function generateOutreach() {
    if (!supabase || !application || !analysis || !selectedContact || !cv) {
      setError('A tracked application, Phase 2 analysis, selected contact, and uploaded master CV are required.'); return
    }
    setGenerating(true); setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<PrepareOutreachResponse>('prepare-outreach', { body: { application, analysis, contact: selectedContact, cv, candidate, depth } })
      if (invokeError) throw invokeError
      if (!data?.outreach) throw new Error('Outreach generation returned no draft.')
      setDrafts((current) => new Map(current).set(selectedContact.id, data.outreach))
      await persistDraft(data.outreach)
    } catch (err) { setError(await readableFunctionError(err)) }
    finally { setGenerating(false) }
  }

  function updateDraft(patch: Partial<OutreachDraft>) {
    if (!selectedDraft || !selectedContact) return
    setDrafts((current) => new Map(current).set(selectedContact.id, { ...selectedDraft, ...patch }))
  }

  async function saveDraft() {
    if (selectedDraft) await persistDraft(selectedDraft)
  }

  async function markSent() {
    if (!selectedDraft || !selectedContact) return
    const now = new Date().toISOString()
    const followUpAt = addDaysISO(7)
    const updatedDraft: OutreachDraft = { ...selectedDraft, status: 'Sent', sentAt: now, followUpAt }
    const updatedContact: NetworkingContact = { ...selectedContact, status: 'Contacted', followUpAt, updatedAt: now }
    setDrafts((current) => new Map(current).set(updatedContact.id, updatedDraft))
    setContacts((current) => new Map(current).set(updatedContact.id, updatedContact))
    await Promise.all([persistDraft(updatedDraft), persistContact(updatedContact)])
  }

  function copy(text: string) { void navigator.clipboard.writeText(text) }
  function openGmail() {
    if (!selectedContact?.publicEmail || !selectedDraft) return
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(selectedContact.publicEmail)}&su=${encodeURIComponent(selectedDraft.emailSubject)}&body=${encodeURIComponent(selectedDraft.emailBody)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <header className="topbar networking-topbar">
        <div>
          <p className="eyebrow">PUBLIC CONTACT DISCOVERY · PHASE 5</p>
          <h1>Recruiter & hiring-manager intelligence</h1>
          <p>Find likely relevant recruiters and HEOR/RWE leaders from public LinkedIn profiles, rank them, and prepare fact-locked outreach. No LinkedIn password is used and no message is sent automatically.</p>
        </div>
      </header>

      <section className="phase5-summary">
        <div><span>Contacts</span><strong>{applicationContacts.length}</strong><small>Public profiles for selected role</small></div>
        <div><span>Recruiters</span><strong>{recruiterCount}</strong><small>Talent / early-career signals</small></div>
        <div><span>HEOR leaders</span><strong>{leaderCount}</strong><small>Domain / management signals</small></div>
        <div><span>Contacted</span><strong>{contactedCount}</strong><small>Tracked outreach activity</small></div>
      </section>

      {error && <div className="error-box wide">Networking: {error}</div>}

      <section className="networking-control-card">
        <div className="networking-control-head">
          <div><UserRoundSearch size={18} /><span><strong>Choose a tracked application</strong><small>Employer name must be resolved before public-contact discovery.</small></span></div>
          <button className="primary-btn" onClick={discoverContacts} disabled={discovering || !application || unresolvedCompany(application)}><RefreshCw size={15} className={discovering ? 'spin' : ''} /> {discovering ? 'Searching public profiles…' : 'Find recruiter contacts'}</button>
        </div>
        <select value={selectedApplicationId} onChange={(e) => { setSelectedApplicationId(e.target.value); setSelectedContactId(''); setError(''); setDiscoveryNote('') }}>
          <option value="">Select an application…</option>
          {applicationList.map((item) => <option key={item.id} value={item.id}>{item.job.company} — {item.job.title}</option>)}
        </select>
        {application && unresolvedCompany(application) && <div className="phase5-warning"><AlertTriangle size={15} /> Employer is unresolved. Return to Applications and enter/resolve the company before discovering contacts.</div>}
        {application && analysis?.recommendation === 'SKIP' && !application.eligibilityOverride && <div className="phase5-warning"><AlertTriangle size={15} /> Phase 2 classified this role SKIP. Networking can still be informational, but the generated outreach will warn against application advocacy.</div>}
        {discoveryNote && <div className="phase5-note">{discoveryNote}</div>}
      </section>

      {!application ? (
        <section className="empty-state compact"><h2>Track an application first</h2><p>Phase 5 works from applications so the employer, job context, and Phase 2 analysis remain attached to each outreach record.</p></section>
      ) : (
        <section className="networking-layout">
          <aside className="contact-list-card">
            <div className="contact-list-heading"><UsersRound size={17} /><div><strong>Likely relevant contacts</strong><small>Ranked from public search evidence</small></div></div>
            {applicationContacts.length === 0 ? <div className="contact-empty"><Search size={20} /><span>Run Find recruiter contacts.</span></div> : applicationContacts.map((contact) => (
              <button key={contact.id} className={`contact-list-item ${selectedContact?.id === contact.id ? 'active' : ''}`} onClick={() => setSelectedContactId(contact.id)}>
                <div className="contact-score">{contact.relevanceScore}</div>
                <div><strong>{contact.name}</strong><span>{contact.title || roleLabel(contact.roleCategory)}</span><small>{roleLabel(contact.roleCategory)} · {contact.status}</small></div>
              </button>
            ))}
          </aside>

          <div className="networking-detail-column">
            {!selectedContact ? <section className="empty-state compact"><h2>No contact selected</h2><p>Discover public contacts and select one to prepare outreach.</p></section> : (
              <>
                <section className="contact-detail-card">
                  <div className="contact-detail-head">
                    <div><div className="contact-role-pill">{roleLabel(selectedContact.roleCategory)} · {selectedContact.relevanceScore}/100</div><h2>{selectedContact.name}</h2><p>{selectedContact.title || 'Title not reliably parsed'} · {selectedContact.company}</p></div>
                    {selectedContact.linkedinUrl && <a href={selectedContact.linkedinUrl} target="_blank" rel="noreferrer"><Linkedin size={15} /> Open LinkedIn <ExternalLink size={12} /></a>}
                  </div>
                  <div className="contact-reasons">{selectedContact.relevanceReasons.map((reason) => <span key={reason}><Check size={12} /> {reason}</span>)}</div>
                  {selectedContact.sourceSnippet && <div className="public-snippet"><b>Public search snippet</b><p>{selectedContact.sourceSnippet}</p></div>}
                  <div className="contact-edit-grid">
                    <label><span>Verified work/public email <em>optional</em></span><input value={selectedContact.publicEmail} onChange={(e) => updateContact({ publicEmail: e.target.value })} placeholder="Enter only a verified public/business email" /></label>
                    <label><span>Status</span><select value={selectedContact.status} onChange={(e) => updateContact({ status: e.target.value as ContactStatus })}>{['Discovered','Saved','Contacted','Replied','Follow-up due','Closed'].map((x) => <option key={x}>{x}</option>)}</select></label>
                    <label><span>Follow-up</span><input type="date" value={selectedContact.followUpAt} onChange={(e) => updateContact({ followUpAt: e.target.value })} /></label>
                    <label className="contact-notes"><span>Notes</span><input value={selectedContact.notes} onChange={(e) => updateContact({ notes: e.target.value })} placeholder="Context, referral, conversation notes…" /></label>
                  </div>
                  <div className="networking-actions"><button className="primary-btn" onClick={generateOutreach} disabled={generating || !analysis || !cv}><Sparkles size={15} /> {generating ? 'Drafting…' : selectedDraft ? 'Regenerate outreach' : 'Generate personalized outreach'}</button><span>Standard mode uses GPT-5.6 Luna.</span></div>
                </section>

                {selectedDraft && <section className="outreach-draft-grid">
                  <div className="outreach-main-card">
                    <div className="outreach-heading"><div><Send size={17} /><span><strong>LinkedIn outreach</strong><small>You review and send manually.</small></span></div><div className={`fact-chip ${selectedDraft.factLock.passed ? 'passed' : 'review'}`}>{selectedDraft.factLock.passed ? 'Fact lock passed' : 'Review evidence'}</div></div>
                    <label className="outreach-field"><span>Connection note <em>{selectedDraft.linkedinConnectionNote.length}/280</em></span><textarea value={selectedDraft.linkedinConnectionNote} maxLength={280} onChange={(e) => updateDraft({ linkedinConnectionNote: e.target.value })} rows={4} /></label>
                    <div className="outreach-field-actions"><button onClick={() => copy(selectedDraft.linkedinConnectionNote)}><Copy size={13} /> Copy note</button>{selectedContact.linkedinUrl && <a href={selectedContact.linkedinUrl} target="_blank" rel="noreferrer"><Linkedin size={13} /> Open LinkedIn</a>}</div>
                    <label className="outreach-field"><span>Follow-up message</span><textarea value={selectedDraft.linkedinFollowUp} onChange={(e) => updateDraft({ linkedinFollowUp: e.target.value })} rows={6} /></label>
                    <div className="outreach-field-actions"><button onClick={() => copy(selectedDraft.linkedinFollowUp)}><Copy size={13} /> Copy follow-up</button></div>
                  </div>

                  <aside className="email-outreach-card">
                    <div className="outreach-heading"><div><Mail size={17} /><span><strong>Recruiter email</strong><small>Uses only a verified email you provide/find publicly.</small></span></div></div>
                    <label className="outreach-field"><span>Subject</span><input value={selectedDraft.emailSubject} onChange={(e) => updateDraft({ emailSubject: e.target.value })} /></label>
                    <label className="outreach-field"><span>Email body</span><textarea value={selectedDraft.emailBody} onChange={(e) => updateDraft({ emailBody: e.target.value })} rows={12} /></label>
                    <div className="outreach-field-actions stacked"><button onClick={() => copy(`${selectedDraft.emailSubject}\n\n${selectedDraft.emailBody}`)}><Copy size={13} /> Copy email</button><button onClick={openGmail} disabled={!selectedContact.publicEmail}><Mail size={13} /> Open Gmail compose</button><button onClick={saveDraft}><Check size={13} /> Save edits</button><button className="mark-contacted" onClick={markSent}><Send size={13} /> Mark outreach sent</button></div>
                    {!selectedContact.publicEmail && <div className="phase5-warning compact"><AlertTriangle size={13} /> No verified public email. Do not guess a personal address; use LinkedIn or enter a verified business email.</div>}
                    {selectedDraft.cautions.length > 0 && <div className="outreach-cautions"><b>Cautions</b>{selectedDraft.cautions.map((caution) => <span key={caution}>{caution}</span>)}</div>}
                    <div className="personalization-points"><b>Personalization used</b>{selectedDraft.personalizationPoints.map((point) => <span key={point}>{point}</span>)}</div>
                  </aside>
                </section>}
              </>
            )}
          </div>
        </section>
      )}
    </>
  )
}
