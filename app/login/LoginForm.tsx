'use client'
import { useState } from 'react'

export default function LoginForm({ linkFailed }: { linkFailed: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState(linkFailed ? 'That link has expired or was already used. Request a new one below.' : '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not send the link. Please try again.')
      setState('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link. Please try again.')
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'10px', padding:'16px' }}>
        <div style={{ fontSize:'14px', fontWeight:600, color:'#1E3A5F' }}>Check your email</div>
        <p style={{ fontSize:'13px', color:'#475569', margin:'6px 0 0', lineHeight:1.5 }}>
          If <strong>{email.trim()}</strong> has access to Arthur, a sign-in link is on its way. Open it in this browser.
          Nothing after a few minutes? Check spam, or ask the Arthur team to confirm your access.
        </p>
        <button onClick={() => setState('idle')} style={{
          marginTop:'12px', background:'none', border:'none', padding:0, color:'#2563EB', fontSize:'13px', cursor:'pointer', fontFamily:'inherit',
        }}>
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      <label style={{ fontSize:'12px', fontWeight:600, color:'#475569' }}>
        Email
        <input
          type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            display:'block', width:'100%', marginTop:'6px', padding:'11px 12px', fontSize:'14px', fontFamily:'inherit',
            border:'1px solid #CBD5E1', borderRadius:'9px', outline:'none', boxSizing:'border-box',
          }}
        />
      </label>
      {error && <div style={{ fontSize:'12px', color:'#DC2626' }}>{error}</div>}
      <button type="submit" className="btn-primary" disabled={state === 'sending'} style={{ padding:'11px', fontSize:'14px' }}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  )
}
