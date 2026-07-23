'use client'
import { COURSES } from './studentData'

function ProgressRing({ value, color, size = 36 }: { value: number; color: string; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - value / 100)
  return (
    <svg width={size} height={size} style={{ flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth="3"/>
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transform:'rotate(-90deg)', transformOrigin:'center', transition:'stroke-dashoffset .5s ease' }}
      />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize:'9px', fontWeight:700, fill:color, fontFamily:'Inter' }}>
        {value}
      </text>
    </svg>
  )
}

export default function StudentSidebar({ selectedCourse, setSelectedCourse }: any) {
  const totalCredits = COURSES.reduce((s,c) => s + c.credits, 0)
  const avgProgress = Math.round(COURSES.reduce((s,c) => s + c.progress, 0) / COURSES.length)

  return (
    <aside style={{
      width:'268px', flexShrink:0, background:'#fff',
      borderRight:'1px solid #E2E8F0', display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      {/* Student summary */}
      <div style={{ padding:'16px', borderBottom:'1px solid #E2E8F0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
          <div style={{
            width:'40px', height:'40px', borderRadius:'50%', background:'linear-gradient(135deg,#3B82F6,#1D4ED8)',
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:'14px',
          }}>SK</div>
          <div>
            <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A' }}>Sara Kamau</div>
            <div style={{ fontSize:'11px', color:'#94A3B8' }}>Year 2 · BCom · SBS</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          <div style={{ background:'#F8FAFC', borderRadius:'8px', padding:'8px 10px' }}>
            <div style={{ fontSize:'10px', color:'#94A3B8', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' }}>Avg mastery</div>
            <div style={{ fontSize:'18px', fontWeight:700, color:'#2563EB', lineHeight:1.2 }}>{avgProgress}%</div>
          </div>
          <div style={{ background:'#F8FAFC', borderRadius:'8px', padding:'8px 10px' }}>
            <div style={{ fontSize:'10px', color:'#94A3B8', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' }}>Credits</div>
            <div style={{ fontSize:'18px', fontWeight:700, color:'#0F172A', lineHeight:1.2 }}>{totalCredits}</div>
          </div>
        </div>
      </div>

      {/* Courses */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
        <div style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:'8px', paddingLeft:'4px' }}>
          My Courses
        </div>
        {COURSES.map(c => {
          const isActive = selectedCourse.code === c.code
          return (
            <button
              key={c.code}
              onClick={() => setSelectedCourse(c)}
              style={{
                width:'100%', textAlign:'left', padding:'10px 12px',
                borderRadius:'10px', border:'none', cursor:'pointer',
                background: isActive ? '#EFF6FF' : 'transparent',
                outline: isActive ? '1.5px solid #BFDBFE' : '1.5px solid transparent',
                marginBottom:'4px', transition:'all .15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background='#F8FAFC' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background='transparent' }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <ProgressRing value={c.progress} color={isActive ? '#2563EB' : c.color} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:600, color: isActive ? '#1D4ED8' : '#0F172A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'1px' }}>
                    {c.code} · {c.lecturer}
                  </div>
                </div>
              </div>
            </button>
          )
        })}

        {/* Arthur insight */}
        <div style={{
          marginTop:'16px', padding:'12px', borderRadius:'10px',
          background:'linear-gradient(135deg,#EFF6FF,#F0F9FF)',
          border:'1px solid #BFDBFE',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
            <span className="ai-pulse" style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#2563EB', display:'inline-block' }}/>
            <span style={{ fontSize:'10px', fontWeight:700, color:'#1D4ED8', textTransform:'uppercase', letterSpacing:'.5px' }}>Arthur suggests</span>
          </div>
          <p style={{ fontSize:'12px', color:'#1E40AF', lineHeight:1.5, margin:0 }}>
            Your <strong>Depreciation</strong> score in SBS 201 is 38%. This comes up in every final exam. Let's work on it today.
          </p>
          <button
            style={{ marginTop:'8px', fontSize:'11px', fontWeight:600, color:'#2563EB', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}
            onClick={() => {}}
          >
            Start a session →
          </button>
        </div>

        {/* Upcoming assessment */}
        <div style={{ marginTop:'12px', padding:'12px', borderRadius:'10px', background:'#FFFBEB', border:'1px solid #FDE68A' }}>
          <div style={{ fontSize:'10px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'5px' }}>
            ⏰ Upcoming
          </div>
          <div style={{ fontSize:'12px', color:'#78350F', fontWeight:500 }}>SBS 201 CAT 2</div>
          <div style={{ fontSize:'11px', color:'#92400E', marginTop:'2px' }}>In 6 days · Chapters 4–7</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid #E2E8F0' }}>
        <div style={{ fontSize:'11px', color:'#94A3B8', display:'flex', alignItems:'center', gap:'5px' }}>
          <span className="ai-pulse" style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#059669', display:'inline-block' }}/>
          Arthur is grounded in your suLMS materials
        </div>
      </div>
    </aside>
  )
}
