'use client'
import { useState } from 'react'
import { useStore, type LecturerQuestion } from '../../lib/demoStore'
import { timeAgo } from '../../lib/format'

const COURSE = 'SBS 201'

const askedLabel = (q: LecturerQuestion) => typeof q.askedAt === 'number' ? timeAgo(q.askedAt) : q.askedAt
const urgencyBadge = (u: string) => u==='High'?'badge-red':u==='Medium'?'badge-amber':'badge-gray'

export default function LecturerQuestions() {
  const { state, replyToQuestion, saveAnswerToCourse } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  // Unanswered first, then newest first; seeded questions sit below new ones.
  const questions = state.questions
    .filter(q => q.course === COURSE)
    .sort((a, b) =>
      Number(!!a.reply) - Number(!!b.reply) ||
      (typeof b.askedAt === 'number' ? b.askedAt : 0) - (typeof a.askedAt === 'number' ? a.askedAt : 0))
  const selected = questions.find(q => q.id === selectedId)

  const unanswered = questions.filter(q => !q.reply)
  const answered   = questions.filter(q => q.reply)

  const sendReply = () => {
    if (!selected || !reply.trim()) return
    replyToQuestion(selected.id, reply.trim())
    setReply('')
  }

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden', background:'#F8FAFC' }}>
      {/* List */}
      <div style={{ width:'380px', flexShrink:0, background:'#fff', borderRight:'1px solid #E2E8F0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0' }}>
          <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Student questions (S10 · L6)</div>
          <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Each question arrives with context from Curriculum AI</div>
          <div style={{ display:'flex', gap:'10px', marginTop:'12px', fontSize:'12px' }}>
            <span className="badge badge-red">{unanswered.length} unanswered</span>
            <span className="badge badge-green">{answered.length} answered</span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {questions.map(q=>(
            <div
              key={q.id}
              onClick={()=>{ setSelectedId(q.id); setReply('') }}
              style={{
                padding:'14px 18px', borderBottom:'1px solid #F1F5F9', cursor:'pointer',
                background: selectedId===q.id ? '#EFF6FF' : 'transparent',
                borderLeft: selectedId===q.id ? '3px solid #2563EB' : '3px solid transparent',
                transition:'all .15s',
              }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                <span className={`badge ${urgencyBadge(q.urgency)}`} style={{ fontSize:'10px' }}>
                  {q.urgency} urgency
                </span>
                <span style={{ fontSize:'10px', color:'#94A3B8' }}>{askedLabel(q)}</span>
              </div>
              <div style={{ fontSize:'12px', fontWeight:500, color:'#0F172A', marginBottom:'3px' }}>
                {q.topic} · <span style={{ fontFamily:'monospace', fontSize:'10px', color:'#94A3B8' }}>{q.studentId}</span>
              </div>
              <p style={{ fontSize:'12px', color:'#64748B', lineHeight:1.4, margin:0,
                overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>
                {q.question}
              </p>
              <div style={{ marginTop:'6px' }}>
                <span className={`badge ${q.reply?'badge-green':'badge-amber'}`} style={{ fontSize:'10px' }}>
                  {q.reply?'✓ Answered':'Awaiting reply'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div style={{ flex:1, overflow:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
          <div>
            <div style={{ display:'flex', gap:'10px', marginBottom:'10px', flexWrap:'wrap' }}>
              <span className={`badge ${urgencyBadge(selected.urgency)}`}>{selected.urgency} urgency</span>
              <span className="badge badge-blue">{selected.topic}</span>
              <span className="badge badge-gray" style={{ fontFamily:'monospace', fontSize:'10px' }}>{selected.studentId}</span>
              <span style={{ fontSize:'11px', color:'#94A3B8', alignSelf:'center' }}>{askedLabel(selected)}</span>
            </div>
            <div className="card" style={{ padding:'18px' }}>
              <div style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'8px' }}>Student&apos;s question</div>
              <p style={{ fontSize:'14px', color:'#0F172A', lineHeight:1.7, margin:0 }}>{selected.question}</p>
            </div>
          </div>

          {/* Context from Curriculum AI */}
          <div style={{ padding:'14px 16px', background:'#EFF6FF', borderRadius:'10px', border:'1px solid #BFDBFE' }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:'#1D4ED8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'6px' }}>
              Context Curriculum AI collected (S10)
            </div>
            <p style={{ fontSize:'12px', color:'#1E40AF', lineHeight:1.6, margin:0 }}>{selected.context}</p>
          </div>

          {/* Answer */}
          {selected.reply ? (
            <div>
              <div className="card" style={{ padding:'18px', border:'1.5px solid #A7F3D0' }}>
                <div style={{ fontSize:'10px', fontWeight:700, color:'#065F46', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'8px' }}>Your reply</div>
                <p style={{ fontSize:'13px', color:'#0F172A', lineHeight:1.7, margin:0 }}>{selected.reply}</p>
              </div>
              <div style={{ display:'flex', gap:'10px', marginTop:'12px' }}>
                <button
                  onClick={()=>saveAnswerToCourse(selected.id)}
                  disabled={selected.savedToCourse}
                  className="btn-primary"
                  style={{ flex:1 }}
                >
                  {selected.savedToCourse ? '✓ Saved to course material' : 'Save answer to course material (L9)'}
                </button>
              </div>
              {selected.savedToCourse && (
                <p style={{ fontSize:'12px', color:'#059669', marginTop:'8px', textAlign:'center' }}>
                  ✓ Curriculum AI now uses this answer when any {COURSE} student asks about {selected.topic.toLowerCase()}.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:'12px', fontWeight:500, color:'#475569', marginBottom:'8px' }}>Your reply</div>
              <textarea
                value={reply}
                onChange={e=>setReply(e.target.value)}
                placeholder="Type your answer here. You can then save strong answers to the course material, so Curriculum AI uses them for every student (L9)..."
                rows={6}
                style={{
                  width:'100%', padding:'12px 14px', borderRadius:'10px', fontSize:'13px',
                  border:'1.5px solid #E2E8F0', background:'#F8FAFC', color:'#0F172A',
                  fontFamily:'inherit', resize:'vertical', outline:'none', lineHeight:1.6,
                }}
                onFocus={e=>{ e.target.style.borderColor='#93C5FD'; e.target.style.background='#fff' }}
                onBlur={e=>{ e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC' }}
              />
              <button onClick={sendReply} className="btn-primary" style={{ width:'100%', marginTop:'12px' }} disabled={!reply.trim()}>
                Send reply to student →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#94A3B8', flexDirection:'column', gap:'8px' }}>
          <div style={{ fontSize:'32px' }}>💬</div>
          <div style={{ fontSize:'14px', fontWeight:500 }}>Select a question to reply</div>
          <div style={{ fontSize:'12px' }}>{unanswered.length} question{unanswered.length!==1?'s':''} awaiting your reply</div>
        </div>
      )}
    </div>
  )
}
