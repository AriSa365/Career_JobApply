import { KeyRound, ServerCog } from 'lucide-react'

export default function ConfigMissing() {
  return (
    <div className="setup-shell">
      <div className="setup-card">
        <div className="brand-mark"><ServerCog size={25} /></div>
        <p className="eyebrow">ONE-TIME SETUP</p>
        <h1>Connect the secure backend</h1>
        <p>The dashboard code is ready, but it needs your Supabase project before it can sign in or search live jobs.</p>
        <ol>
          <li>Create/copy <code>.env.example</code> to <code>.env.local</code>.</li>
          <li>Add your Supabase project URL and browser-safe publishable key.</li>
          <li>Deploy the included <code>search-jobs</code> Edge Function.</li>
          <li>Store <code>SERPAPI_KEY</code> and <code>ALLOWED_EMAIL</code> as Supabase secrets.</li>
        </ol>
        <div className="security-note"><KeyRound size={15} /> The SerpApi key is never stored in the GitHub Pages frontend.</div>
        <p className="setup-hint">Full commands are in <strong>README.md</strong>.</p>
      </div>
    </div>
  )
}
