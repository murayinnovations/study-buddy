'use client'
import { useState } from 'react'
import { MIN_PASSWORD } from '../lib/password'
import { inputStyle, labelStyle } from '../login/LoginForm'

export default function NewPasswordForm() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not save the password. Please try again.')
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the password. Please try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <h1 style={{ fontSize:'18px', fontWeight:700, color:'#0F172A', margin:0 }}>Choose a new password</h1>
      <p style={{ fontSize:'13px', color:'#64748B', margin:'6px 0 20px', lineHeight:1.5 }}>
        You&apos;ll use it to sign in from now on.
      </p>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <label style={labelStyle}>
          New password
          <input type="password" required autoFocus minLength={MIN_PASSWORD} autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          <span style={{ display:'block', marginTop:'5px', fontSize:'11px', fontWeight:400, color:'#94A3B8' }}>
            At least {MIN_PASSWORD} characters
          </span>
        </label>
        {error && <div style={{ fontSize:'12px', color:'#DC2626' }}>{error}</div>}
        <button type="submit" className="btn-primary" disabled={busy} style={{ padding:'11px', fontSize:'14px' }}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </>
  )
}
