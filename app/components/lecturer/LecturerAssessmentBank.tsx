'use client'
import { useEffect, useState } from 'react'
import { timeAgo } from '../../lib/format'

// The course's starting-level questions for the onboarding assessment (/api/assessment/bank).
// Study Buddy writes them from approved material; students only see them once approved.

interface Item { id: string; level: 1 | 2 | 3; prompt: string; options: string[]; answer: number }
interface Bank { course: string; items: Item[]; status: 'draft' | 'approved'; updatedAt: number }

const LEVEL = { 1: 'Basic', 2: 'Understanding', 3: 'Applying' } as const

export default function LecturerAssessmentBank({ courseName }: { courseName: string }) {
  const [bank, setBank] = useState<Bank | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/assessment/bank', { cache: 'no-store' })
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setBank(body.bank) })
      .catch(err => { setError(err.message || 'Could not load the questions.'); setBank(null) })
  }, [])

  async function act(action: 'generate' | 'approve' | 'unapprove' | 'discard') {
    setBusy(action)
    setError('')
    try {
      const res = await fetch('/api/assessment/bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not save that.')
      setBank(body.bank)
      if (action === 'generate') setOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setBusy(null)
    }
  }

  const button = (action: Parameters<typeof act>[0], label: string, primary = false) => (
    <button onClick={() => act(action)} disabled={busy !== null} className={primary ? 'btn-primary' : 'btn-ghost'} style={{ fontSize:'12px', padding:'6px 14px' }}>
      {busy === action ? (action === 'generate' ? 'Writing… (about a minute)' : 'Saving…') : label}
    </button>
  )

  return (
    <div className="card" style={{ padding:'20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', gap:'12px', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Starting-level questions</div>
          <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px', maxWidth:'560px' }}>
            Each student answers 8 of these, drawn at random, in the onboarding assessment, so Study Buddy knows where to start with them in {courseName}. Study Buddy writes them from your approved material; students only see them once you approve them.
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {bank === null && button('generate', 'Write questions', true)}
          {bank?.status === 'draft' && <>{button('approve', 'Approve for students', true)}{button('generate', 'Write a new set')}{button('discard', 'Discard')}</>}
          {bank?.status === 'approved' && <>{button('unapprove', 'Stop using')}{button('generate', 'Write a new set')}</>}
        </div>
      </div>

      {error && <div role="alert" style={{ marginBottom:'12px', fontSize:'12px', color:'#B91C1C', background:'#FEF2F2', padding:'8px 12px', borderRadius:'8px' }}>{error}</div>}
      {bank === undefined && <div style={{ fontSize:'12px', color:'#94A3B8' }}>Loading…</div>}
      {bank === null && !error && <div style={{ fontSize:'12px', color:'#64748B' }}>No questions yet. Until you approve some, students rate how familiar they are with the course instead.</div>}

      {bank && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'12px', color:'#64748B' }}>
            <span className={`badge ${bank.status === 'approved' ? 'badge-green' : 'badge-amber'}`}>{bank.status === 'approved' ? '✓ In use' : 'Draft: not shown to students'}</span>
            {bank.items.length} questions · updated {timeAgo(bank.updatedAt)}
            <button onClick={() => setOpen(!open)} style={{ marginLeft:'auto', fontSize:'12px', color:'#0D1B3D', background:'none', border:'none', textDecoration:'underline', cursor:'pointer', fontFamily:'inherit' }}>
              {open ? 'Hide questions' : 'Review questions'}
            </button>
          </div>
          {open && (
            <ol style={{ margin:'14px 0 0', paddingLeft:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
              {[...bank.items].sort((a, b) => a.level - b.level).map(item => (
                <li key={item.id} style={{ fontSize:'12.5px', color:'#0F172A' }}>
                  <span className="badge badge-gray" style={{ fontSize:'10px', marginRight:'6px' }}>{LEVEL[item.level]}</span>
                  {item.prompt}
                  <ul style={{ margin:'6px 0 0', paddingLeft:'16px', color:'#475569' }}>
                    {item.options.map((o, i) => (
                      <li key={i} style={{ fontWeight: i === item.answer ? 600 : 400, color: i === item.answer ? '#047857' : undefined }}>
                        {o}{i === item.answer ? ' (correct)' : ''}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
