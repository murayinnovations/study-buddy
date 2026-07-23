'use client'
import type { Role } from '../../page'

const ROLES: { id: Role; label: string; avatar: string; name: string; subtitle: string }[] = [
  { id: 'student',  label: 'Student',          avatar: 'SK', name: 'Sara Kamau',       subtitle: 'Year 2 · BCom' },
  { id: 'lecturer', label: 'Lecturer',          avatar: 'PM', name: 'Prof. P. Mwangi',  subtitle: 'SBS 201 · Financial Accounting' },
  { id: 'hod',      label: 'Head of Department', avatar: 'DN', name: 'Dr. N. Njoroge',   subtitle: 'Head, Strathmore Business School' },
]

export default function AppShell({ role, setRole, children }: {
  role: Role; setRole: (r: Role) => void; children: React.ReactNode
}) {
  const current = ROLES.find(r => r.id === role)!

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* Top bar */}
      <header style={{
        background:'#1E3A5F', padding:'0 24px', display:'flex',
        alignItems:'center', justifyContent:'space-between', height:'52px', flexShrink:0,
      }}>
        {/* Arthur logo */}
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
            <div style={{ color:'#fff', fontWeight:600, fontSize:'15px', lineHeight:1 }}>Arthur</div>
            <div style={{ color:'rgba(255,255,255,.45)', fontSize:'10px', letterSpacing:'.3px' }}>Strathmore University · Pilot</div>
          </div>
        </div>

        {/* Role switcher */}
        <div style={{
          display:'flex', alignItems:'center', gap:'4px',
          background:'rgba(255,255,255,.07)', borderRadius:'10px', padding:'4px',
        }}>
          {ROLES.map(r => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              style={{
                padding:'6px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:500,
                color: role === r.id ? '#1E3A5F' : 'rgba(255,255,255,.6)',
                background: role === r.id ? '#fff' : 'transparent',
                border:'none', cursor:'pointer', transition:'all .15s', fontFamily:'inherit',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* User chip */}
        <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ color:'rgba(255,255,255,.9)', fontSize:'12px', fontWeight:500 }}>{current.name}</div>
            <div style={{ color:'rgba(255,255,255,.4)', fontSize:'10px' }}>{current.subtitle}</div>
          </div>
          <div style={{
            width:'32px', height:'32px', borderRadius:'50%',
            background:'#3B82F6', display:'flex', alignItems:'center',
            justifyContent:'center', color:'#fff', fontSize:'11px', fontWeight:700,
          }}>
            {current.avatar}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {children}
      </main>
    </div>
  )
}
