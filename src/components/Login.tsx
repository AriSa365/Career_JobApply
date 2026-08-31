import { useState } from 'react'
import { BriefcaseBusiness, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(authError.message)
    setBusy(false)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark"><BriefcaseBusiness size={25} /></div>
        <p className="eyebrow">PRIVATE CAREER WORKSPACE</p>
        <h1>HEOR Career Agent</h1>
        <p className="auth-copy">Sign in to run your protected internship search. Job-provider credentials stay in the server-side Supabase Edge Function.</p>
        <form onSubmit={signIn} className="auth-form">
          <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="security-note"><LockKeyhole size={15} /> Single-user access is enforced again in the Edge Function.</div>
      </div>
    </div>
  )
}
