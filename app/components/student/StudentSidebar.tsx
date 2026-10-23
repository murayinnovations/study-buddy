'use client'
import { useState } from 'react'
import { COURSES, CURRENT_WEEK, type Course } from './studentData'
import { useStore } from '../../lib/demoStore'
import { PILOT_COURSE } from '../../lib/demoData'
import { average, initials } from '../../lib/format'

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

export default function StudentSidebar({ selectedCourse, setSelectedCourse, onStartSession }: {
  selectedCourse: Course
  setSelectedCourse: (c: Course) => void
  onStartSession: (c: Course, topic: string) => void
}) {
  const { member, state, markRepliesSeen } = useStore()
  const [showReplies, setShowReplies] = useState(false)

  const courseProgress = (code: string) => average((state.mastery[code] || []).map(t => t.score))
  const totalCredits = COURSES.reduce((s,c) => s + c.credits, 0)
  const avgProgress = average(COURSES.map(c => courseProgress(c.code)))

  // Weakest topic the student has started and the class has been taught, in the
  // pilot course: the only one where Curriculum AI has course notes to teach from.
  const suggestion = COURSES
    .filter(c => c.code === PILOT_COURSE)
    .flatMap(c => (state.mastery[c.code] || [])
      .filter(t => t.sessions > 0 && (t.week ?? 0) <= CURRENT_WEEK)
      .map(t => ({ course: c, ...t })))
    .sort((a, b) => a.score - b.score)[0]

  const replies = state.questions.filter(q => q.studentId === member.studentId && q.reply)
  const unseen = replies.filter(q => !q.seenByStudent).length

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
          }}>{initials(member.name)}</div>
          <div>
            <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A' }}>{member.name}</div>
            <div style={{ fontSize:'11px', color:'#94A3B8' }}>{member.subtitle}</div>
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
                <ProgressRing value={courseProgress(c.code)} color={isActive ? '#2563EB' : c.color} />
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

        {/* Lecturer replies (S10) */}
        {replies.length > 0 && (
          <div style={{ marginTop:'16px', padding:'12px', borderRadius:'10px', background:'#F0FDF4', border:'1px solid #A7F3D0' }}>
            <button
              onClick={() => { setShowReplies(!showReplies); if (unseen) markRepliesSeen() }}
              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:'inherit' }}
            >
              <span style={{ fontSize:'10px', fontWeight:700, color:'#065F46', textTransform:'uppercase', letterSpacing:'.5px' }}>
                Lecturer replies
              </span>
              {unseen > 0
                ? <span className="badge badge-green" style={{ fontSize:'10px' }}>{unseen} new</span>
                : <span style={{ fontSize:'11px', color:'#059669' }}>{showReplies ? 'Hide' : 'Show'}</span>}
            </button>
            {showReplies && replies.map(q => (
              <div key={q.id} style={{ marginTop:'10px', fontSize:'12px', lineHeight:1.5 }}>
                <div style={{ color:'#64748B', fontStyle:'italic' }}>“{q.question.length > 90 ? q.question.slice(0, 90) + '…' : q.question}”</div>
                <div style={{ color:'#064E3B', marginTop:'4px' }}>{q.reply}</div>
                <div style={{ fontSize:'10px', color:'#059669', marginTop:'3px' }}>
                  {COURSES.find(c => c.code === q.course)?.lecturer} · {q.topic}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Curriculum AI insight */}
        {suggestion && (
          <div style={{
            marginTop:'16px', padding:'12px', borderRadius:'10px',
            background:'linear-gradient(135deg,#EFF6FF,#F0F9FF)',
            border:'1px solid #BFDBFE',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
              <span className="ai-pulse" style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#2563EB', display:'inline-block' }}/>
              <span style={{ fontSize:'10px', fontWeight:700, color:'#1D4ED8', textTransform:'uppercase', letterSpacing:'.5px' }}>Curriculum AI suggests</span>
            </div>
            <p style={{ fontSize:'12px', color:'#1E40AF', lineHeight:1.5, margin:0 }}>
              Your <strong>{suggestion.topic}</strong> score in {suggestion.course.code} is {suggestion.score}%, your lowest so far. Let&apos;s work on it today.
            </p>
            <button
              style={{ marginTop:'8px', fontSize:'11px', fontWeight:600, color:'#2563EB', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}
              onClick={() => onStartSession(suggestion.course, suggestion.topic)}
            >
              Start a session →
            </button>
          </div>
        )}

        {/* Upcoming assessment */}
        <div style={{ marginTop:'12px', padding:'12px', borderRadius:'10px', background:'#FFFBEB', border:'1px solid #FDE68A' }}>
          <div style={{ fontSize:'10px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'5px' }}>
            ⏰ Upcoming
          </div>
          <div style={{ fontSize:'12px', color:'#78350F', fontWeight:500 }}>SBS 201 CAT 2</div>
          <div style={{ fontSize:'11px', color:'#92400E', marginTop:'2px' }}>In 6 days · Weeks 5–10</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid #E2E8F0' }}>
        <div style={{ fontSize:'11px', color:'#94A3B8', display:'flex', alignItems:'center', gap:'5px' }}>
          <span className="ai-pulse" style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#059669', display:'inline-block' }}/>
          Curriculum AI uses your lecturers&apos; approved materials
        </div>
      </div>
    </aside>
  )
}
