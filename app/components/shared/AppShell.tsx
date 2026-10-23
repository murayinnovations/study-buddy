'use client'
import { useState } from 'react'
import { useStore } from '../../lib/demoStore'
import { initials } from '../../lib/format'
import type { Role } from '../../lib/demoData'

const ROLE_LABEL = { student: 'Student', lecturer: 'Lecturer', hod: 'Head of Department' }
const ROLE_COLOR = { student: '#3B82F6', lecturer: '#0D9488', hod: '#D97706' }
const ROLE_ORDER: Role[] = ['student', 'lecturer', 'hod']

function ViewSwitcher({ role }: { role: Role }) {
  const [switching, setSwitching] = useState<Role | null>(null)

  const switchTo = async (target: Role) => {
    if (target === role || switching) return
    setSwitching(target)
    try {
      const res = await fetch('/api/view-as', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: target }),
      })
      if (res.ok) { window.location.href = '/'; return }
    } catch {}
    setSwitching(null)
  }

  return (
    <div style={{ display:'flex', gap:'2px', background:'rgba(255,255,255,.08)', borderRadius:'8px', padding:'2px' }}>
      {ROLE_ORDER.map(r => (
        <button
          key={r}
          onClick={() => switchTo(r)}
          disabled={Boolean(switching)}
          title={r === role ? undefined : `Switch to the ${ROLE_LABEL[r]} view`}
          style={{
            fontSize:'11px', fontWeight:600, padding:'4px 10px', borderRadius:'6px', cursor: r === role ? 'default' : 'pointer',
            border:'none', fontFamily:'inherit',
            background: r === role ? ROLE_COLOR[r] : 'transparent',
            color: r === role ? '#fff' : 'rgba(255,255,255,.6)',
            opacity: switching && switching !== r ? 0.5 : 1,
          }}
        >
          {switching === r ? 'Switching…' : ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { member, status } = useStore()

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* Top bar */}
      <header style={{
        background:'#1E3A5F', padding:'0 24px', display:'flex',
        alignItems:'center', justifyContent:'space-between', height:'52px', flexShrink:0,
      }}>
        {/* Curriculum AI logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{
            width:'32px', height:'32px', borderRadius:'9px',
            background:'linear-gradient(135deg,#3B82F6,#2563EB)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3C8 3 5 6 5 10c0 2.5 1.2 4.7 3 6.1V18h8v-1.9c1.8-1.4 3-3.6 3-6.1 0-4-3-7-7-7z" fill="white" opacity=".9"/>
              <rect x="9" y="18" width="6" height="2" rx="1" fill="white" opacity=".7"/>
              <rect x="10" y="20" width="4" height="1.5" rx=".75" fill="white" opacity=".5"/>
            </svg>
          </div>
          <div>
            <div style={{ color:'#fff', fontWeight:600, fontSize:'15px', lineHeight:1 }}>Curriculum AI</div>
            <div style={{ color:'rgba(255,255,255,.45)', fontSize:'10px', letterSpacing:'.3px' }}>Strathmore University · Pilot</div>
          </div>
        </div>

        {member.demoGroup ? (
          <ViewSwitcher role={member.role} />
        ) : (
          <span style={{
            fontSize:'11px', fontWeight:600, padding:'4px 10px', borderRadius:'999px',
            color:'#fff', background:ROLE_COLOR[member.role],
          }}>
            {ROLE_LABEL[member.role]}
          </span>
        )}

        {/* User chip */}
        <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
          {status === 'offline' && (
            <span
              title="Curriculum AI's database can't be reached, so changes stay in this tab only"
              style={{ fontSize:'11px', padding:'4px 9px', borderRadius:'6px', background:'#FEF3C7', color:'#92400E', fontWeight:500 }}
            >
              Not saving
            </span>
          )}
          <div style={{ textAlign:'right' }}>
            <div style={{ color:'rgba(255,255,255,.9)', fontSize:'12px', fontWeight:500 }}>{member.name}</div>
            <div style={{ color:'rgba(255,255,255,.4)', fontSize:'10px' }}>{member.subtitle}</div>
          </div>
          <div style={{
            width:'32px', height:'32px', borderRadius:'50%',
            background:ROLE_COLOR[member.role], display:'flex', alignItems:'center',
            justifyContent:'center', color:'#fff', fontSize:'11px', fontWeight:700,
          }}>
            {initials(member.name)}
          </div>
          <form action="/auth/signout" method="post" style={{ margin:0 }}>
            <button type="submit" style={{
              marginLeft:'6px', fontSize:'11px', padding:'4px 9px', borderRadius:'6px', cursor:'pointer', fontFamily:'inherit',
              border:'1px solid rgba(255,255,255,.2)', background:'transparent', color:'rgba(255,255,255,.6)',
            }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {children}
      </main>
    </div>
  )
}
