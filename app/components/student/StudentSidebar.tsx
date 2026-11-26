'use client'
import { useState } from 'react'
import { useStore, type Course } from '../../lib/demoStore'
import { taughtTopics } from '../../lib/demoData'
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
        style={{ fontSize:'9px', fontWeight:700, fill:color, fontFamily:'Poppins' }}>
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

  const courses = state.courses
  const courseProgress = (code: string) => average((state.mastery[code] || []).map(t => t.score))
  const totalCredits = courses.reduce((s,c) => s + c.credits, 0)
  const avgProgress = average(courses.map(c => courseProgress(c.code)))

  // Weakest topic the student has started and the class has been taught, in a
  // course where Study Buddy has approved material to teach from.
  const suggestion = courses
    .filter(c => c.hasMaterials)
    .flatMap(c => {
      const taught = new Set(taughtTopics(c))
      return (state.mastery[c.code] || [])
        .filter(t => t.sessions > 0 && taught.has(t.topic))
        .map(t => ({ course: c, ...t }))
    })
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
            width:'40px', height:'40px', borderRadius:'50%', background:'linear-gradient(135deg,#2E4A86,#0D1B3D)',
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
            <div style={{ fontSize:'18px', fontWeight:700, color:'#0D1B3D', lineHeight:1.2 }}>{avgProgress}%</div>
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
        {courses.map(c => {
          const isActive = selectedCourse.code === c.code
          return (
            <button
              key={c.code}
              onClick={() => setSelectedCourse(c)}
              style={{
                width:'100%', textAlign:'left', padding:'10px 12px',
                borderRadius:'10px', border:'none', cursor:'pointer',
                background: isActive ? '#F1F3F8' : 'transparent',
                outline: isActive ? '1.5px solid #D3D9E6' : '1.5px solid transparent',
                marginBottom:'4px', transition:'all .15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background='#F8FAFC' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background='transparent' }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <ProgressRing value={courseProgress(c.code)} color={isActive ? '#0D1B3D' : c.color} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:600, color: isActive ? '#0D1B3D' : '#0F172A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
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
                  {courses.find(c => c.code === q.course)?.lecturer} · {q.topic}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Study Buddy insight */}
        {suggestion && (
          <div style={{
            marginTop:'16px', padding:'12px', borderRadius:'10px',
            background:'linear-gradient(135deg,#F1F3F8,#F0F9FF)',
            border:'1px solid #D3D9E6',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
              <span className="ai-pulse" style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#0D1B3D', display:'inline-block' }}/>
              <span style={{ fontSize:'10px', fontWeight:700, color:'#0D1B3D', textTransform:'uppercase', letterSpacing:'.5px' }}>Study Buddy suggests</span>
            </div>
            <p style={{ fontSize:'12px', color:'#0D1B3D', lineHeight:1.5, margin:0 }}>
              Your <strong>{suggestion.topic}</strong> score in {suggestion.course.code} is {suggestion.score}%, your lowest so far. Let&apos;s work on it today.
            </p>
            <button
              style={{ marginTop:'8px', fontSize:'11px', fontWeight:600, color:'#0D1B3D', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}
              onClick={() => onStartSession(suggestion.course, suggestion.topic)}
            >
              Start a session →
            </button>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid #E2E8F0' }}>
        <div style={{ fontSize:'11px', color:'#94A3B8', display:'flex', alignItems:'center', gap:'5px' }}>
          <span className="ai-pulse" style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#059669', display:'inline-block' }}/>
          Study Buddy uses your lecturers&apos; approved materials
        </div>
      </div>
    </aside>
  )
}
