'use client'
import { useState } from 'react'
import { useStore } from '../../lib/demoStore'
import { initials } from '../../lib/format'
import type { Role } from '../../lib/demoData'
import DemoGuide from './DemoGuide'

const ROLE_LABEL = { student: 'Student', lecturer: 'Lecturer', hod: 'Head of Department', admin: 'Admin' }
const ROLE_COLOR = { student: '#2E4A86', lecturer: '#0D9488', hod: '#D97706', admin: '#475569' }
const ROLE_ORDER: Role[] = ['student', 'lecturer', 'hod']

function ViewSwitcher({ role, isAdmin }: { role: Role; isAdmin: boolean }) {
  const roles: Role[] = isAdmin ? [...ROLE_ORDER, 'admin'] : ROLE_ORDER
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
      {roles.map(r => (
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

export default function AppShell({ children, isAdmin = false }: { children: React.ReactNode; isAdmin?: boolean }) {
  const { member, status } = useStore()

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* Top bar */}
      <header style={{
        background:'#0D1B3D', borderBottom:'2px solid #E8D44D', padding:'0 24px', display:'flex',
        alignItems:'center', justifyContent:'space-between', height:'52px', flexShrink:0,
      }}>
        {/* Product name */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div>
            <div style={{ color:'#fff', fontWeight:600, fontSize:'15px', lineHeight:1 }}>Study Buddy</div>
            <div style={{ color:'rgba(255,255,255,.45)', fontSize:'10px', letterSpacing:'.3px' }}>Strathmore pilot · by Muray Innovations</div>
          </div>
        </div>

        {member.demoGroup ? (
          <ViewSwitcher role={member.role} isAdmin={isAdmin} />
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
              title="Study Buddy's database can't be reached, so changes stay in this tab only"
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

      {member.demoGroup && <DemoGuide />}
    </div>
  )
}
