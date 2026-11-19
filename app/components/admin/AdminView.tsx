'use client'
import { useCallback, useEffect, useState } from 'react'

// The Curriculum AI team's page: approving learning platforms (such as a university's
// Moodle) that have registered to open Curriculum AI. Admins are added with scripts/members.mjs.

interface PlatformRow {
  id: number; issuer: string; name: string | null; status: 'pending' | 'approved' | 'rejected'; deployments: number
  registeredAt: string; reviewedBy: string | null; reviewedAt: string | null; deleteOn: string | null
}

const STATUS = {
  pending:  { label: 'Waiting for approval', color: '#92400E', background: '#FEF3C7' },
  approved: { label: 'Approved', color: '#065F46', background: '#D1FAE5' },
}

const date = (t: string) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

const th: React.CSSProperties = { textAlign:'left', fontSize:'11px', fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'.4px', padding:'10px 16px', borderBottom:'1px solid #E2E8F0', whiteSpace:'nowrap' }
const td: React.CSSProperties = { fontSize:'13px', color:'#334155', padding:'12px 16px', borderTop:'1px solid #F1F5F9', verticalAlign:'top' }

export default function AdminView() {
  const [platforms, setPlatforms] = useState<PlatformRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platforms', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPlatforms((await res.json()).platforms)
      setError(null)
    } catch {
      setError('Could not load the learning platforms. Refresh to try again.')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const review = async (p: PlatformRow, action: 'approve' | 'reject') => {
    if (action === 'reject' && !window.confirm(p.status === 'approved'
      ? `Revoke ${p.issuer}? Nobody will be able to open Curriculum AI from it. It moves to Rejected and is deleted after 30 days; to connect again, its administrator has to register again.`
      : `Reject ${p.issuer}? It moves to Rejected and is deleted after 30 days. It can't be approved later; if it registers again, it comes back as a new request.`)) return
    setBusy(p.id)
    try {
      const res = await fetch('/api/admin/platforms', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, action }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch {
      setError('Could not save that change. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const active = platforms?.filter(p => p.status !== 'rejected') ?? []
  const rejected = platforms?.filter(p => p.status === 'rejected') ?? []

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', background:'#F8FAFC' }}>
      <div style={{ maxWidth:'900px', margin:'0 auto' }}>
        <h1 style={{ fontSize:'20px', fontWeight:700, color:'#0F172A', margin:0 }}>Learning platforms</h1>
        <p style={{ fontSize:'13px', color:'#64748B', lineHeight:1.6, margin:'6px 0 20px' }}>
          Platforms such as a university&apos;s Moodle register themselves to open Curriculum AI. Nobody can open
          Curriculum AI from one until it&apos;s approved here. Approved platforms sign their students and lecturers in,
          so only approve addresses you recognise.
        </p>

        {error && <div style={{ fontSize:'13px', color:'#991B1B', background:'#FEE2E2', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px' }}>{error}</div>}

        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:'14px', overflow:'hidden' }}>
          {platforms === null ? (
            <div style={{ padding:'24px', fontSize:'13px', color:'#94A3B8' }}>Loading…</div>
          ) : active.length === 0 ? (
            <div style={{ padding:'24px', fontSize:'13px', color:'#94A3B8' }}>
              No platforms are waiting or approved. Give a platform&apos;s administrator the address /lti/register on this site.
            </div>
          ) : active.map((p, i) => {
            const status = STATUS[p.status as 'pending' | 'approved']
            return (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'16px', padding:'16px 20px', borderTop: i ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:600, color:'#0F172A', overflowWrap:'anywhere' }}>{p.issuer}</div>
                  <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'3px' }}>
                    {p.name ? `${p.name} · ` : ''}Registered {date(p.registeredAt)}
                    {p.status === 'approved' && p.reviewedAt && ` · Approved by ${p.reviewedBy} on ${date(p.reviewedAt)}`}
                  </div>
                </div>
                <span style={{ fontSize:'11px', fontWeight:600, padding:'4px 10px', borderRadius:'999px', whiteSpace:'nowrap', color:status.color, background:status.background }}>
                  {status.label}
                </span>
                <div style={{ display:'flex', gap:'8px' }}>
                  {p.status === 'pending' && (
                    <button className="btn-primary" disabled={busy === p.id} onClick={() => review(p, 'approve')} style={{ padding:'7px 14px' }}>Approve</button>
                  )}
                  <button className="btn-ghost" disabled={busy === p.id} onClick={() => review(p, 'reject')} style={{ padding:'7px 14px' }}>
                    {p.status === 'approved' ? 'Revoke' : 'Reject'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {rejected.length > 0 && (
          <>
            <h2 style={{ fontSize:'15px', fontWeight:700, color:'#0F172A', margin:'32px 0 4px' }}>Rejected</h2>
            <p style={{ fontSize:'12px', color:'#64748B', margin:'0 0 12px' }}>
              Turned down or revoked. These can&apos;t be approved again and are deleted 30 days after they were rejected.
            </p>
            <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:'14px', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Address</th>
                    <th style={th}>Platform</th>
                    <th style={th}>Registered</th>
                    <th style={th}>Rejected by</th>
                    <th style={th}>Rejected</th>
                    <th style={th}>Deleted on</th>
                  </tr>
                </thead>
                <tbody>
                  {rejected.map(p => (
                    <tr key={p.id}>
                      <td style={{ ...td, color:'#0F172A', fontWeight:500, overflowWrap:'anywhere' }}>{p.issuer}</td>
                      <td style={td}>{p.name ?? '—'}</td>
                      <td style={{ ...td, whiteSpace:'nowrap' }}>{date(p.registeredAt)}</td>
                      <td style={{ ...td, overflowWrap:'anywhere' }}>{p.reviewedBy ?? '—'}</td>
                      <td style={{ ...td, whiteSpace:'nowrap' }}>{p.reviewedAt ? date(p.reviewedAt) : '—'}</td>
                      <td style={{ ...td, whiteSpace:'nowrap' }}>{p.deleteOn ? date(p.deleteOn) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
