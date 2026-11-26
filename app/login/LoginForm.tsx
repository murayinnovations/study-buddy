'use client'
import { useState } from 'react'
import { MIN_PASSWORD } from '../lib/password'

type Mode = 'signin' | 'signup' | 'forgot'

const TITLES: Record<Mode, { title: string; blurb: string; button: string; busy: string }> = {
  signin: { title: 'Sign in', blurb: 'Welcome back. Sign in with your email and password.', button: 'Sign in', busy: 'Signing in…' },
  signup: { title: 'Create an account', blurb: 'New to Study Buddy? Create an account to start studying.', button: 'Create account', busy: 'Creating account…' },
  forgot: { title: 'Reset your password', blurb: "Enter your email and we'll send you a link to choose a new password.", button: 'Email me a reset link', busy: 'Sending…' },
}

export const inputStyle: React.CSSProperties = {
  display:'block', width:'100%', marginTop:'6px', padding:'11px 12px', fontSize:'14px', fontFamily:'inherit',
  border:'1px solid #CBD5E1', borderRadius:'9px', outline:'none', boxSizing:'border-box',
}
export const labelStyle: React.CSSProperties = { fontSize:'12px', fontWeight:600, color:'#475569' }
const linkStyle: React.CSSProperties = {
  background:'none', border:'none', padding:0, color:'#0D1B3D', fontSize:'13px', cursor:'pointer', fontFamily:'inherit',
}

export default function LoginForm({ linkFailed }: { linkFailed: boolean }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<null | 'confirm' | 'reset'>(null)
  const [error, setError] = useState(linkFailed ? 'That link has expired or was already used. Sign in, or request a new one.' : '')

  const switchTo = (m: Mode) => { setMode(m); setError(''); setSent(null); setPassword('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const path = mode === 'signin' ? 'login' : mode === 'signup' ? 'signup' : 'reset'
    const body = mode === 'forgot' ? { email: email.trim() } : { email: email.trim(), password }
    try {
      const res = await fetch(`/api/auth/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Something went wrong. Please try again.')
      if (mode === 'forgot') setSent('reset')
      else if (mode === 'signup' && !data?.signedIn) setSent('confirm')
      else { window.location.href = '/'; return }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  const t = TITLES[mode]

  return (
    <>
      <h1 style={{ fontSize:'18px', fontWeight:700, color:'#0F172A', margin:0 }}>{t.title}</h1>
      <p style={{ fontSize:'13px', color:'#64748B', margin:'6px 0 20px', lineHeight:1.5 }}>{t.blurb}</p>

      {sent ? (
        <div style={{ background:'#F1F3F8', border:'1px solid #D3D9E6', borderRadius:'10px', padding:'16px' }}>
          <div style={{ fontSize:'14px', fontWeight:600, color:'#0D1B3D' }}>Check your email</div>
          <p style={{ fontSize:'13px', color:'#475569', margin:'6px 0 0', lineHeight:1.5 }}>
            {sent === 'confirm'
              ? <>We sent a link to <strong>{email.trim()}</strong>. Open it to confirm your email and you&apos;ll be signed in.</>
              : <>If <strong>{email.trim()}</strong> has an account, a link to choose a new password is on its way.</>}
            {' '}Nothing after a few minutes? Check your spam folder.
          </p>
          <button onClick={() => switchTo('signin')} style={{ ...linkStyle, marginTop:'12px' }}>Back to sign in</button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <label style={labelStyle}>
            Email
            <input type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" style={inputStyle} />
          </label>
          {mode !== 'forgot' && (
            <label style={labelStyle}>
              <span style={{ display:'flex', justifyContent:'space-between' }}>
                Password
                {mode === 'signin' && (
                  <button type="button" onClick={() => switchTo('forgot')} style={{ ...linkStyle, fontSize:'12px', fontWeight:500 }}>
                    Forgot password?
                  </button>
                )}
              </span>
              <input type="password" required minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
              {mode === 'signup' && (
                <span style={{ display:'block', marginTop:'5px', fontSize:'11px', fontWeight:400, color:'#94A3B8' }}>
                  At least {MIN_PASSWORD} characters
                </span>
              )}
            </label>
          )}
          {error && <div style={{ fontSize:'12px', color:'#DC2626' }}>{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy} style={{ padding:'11px', fontSize:'14px' }}>
            {busy ? t.busy : t.button}
          </button>
          <div style={{ fontSize:'13px', color:'#64748B', textAlign:'center', marginTop:'4px' }}>
            {mode === 'signin'
              ? <>New here? <button type="button" onClick={() => switchTo('signup')} style={linkStyle}>Create an account</button></>
              : <>Already have an account? <button type="button" onClick={() => switchTo('signin')} style={linkStyle}>Sign in</button></>}
          </div>
        </form>
      )}
    </>
  )
}
