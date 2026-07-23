'use client'
import { useState } from 'react'

const QUESTIONS = [
  {
    id:1, studentId:'STR-2023-1104', topic:'Depreciation', urgency:'High', time:'2 hours ago', status:'unanswered',
    question:"I've read the notes on straight-line depreciation twice but I still don't understand why we subtract the residual value before dividing. Why can't we just divide the full cost by the useful life?",
    context:"Student mastery: 38% · Sessions on depreciation: 1 · What they've tried: worked through the formula in Week 6 notes · Last Arthur session: 3 hours ago",
    savedAnswer:null,
  },
  {
    id:2, studentId:'STR-2023-0234', topic:'Accruals', urgency:'Medium', time:'5 hours ago', status:'unanswered',
    question:"I'm confused about the difference between an accrual and a prepayment. Arthur explained it but I'm still not sure which one I should use when rent is paid in advance.",
    context:"Student mastery: 42% · Sessions on accruals: 2 · What they've tried: reviewed Chapter 5 examples · Last Arthur session: 1 hour ago",
    savedAnswer:null,
  },
  {
    id:3, studentId:'STR-2023-0890', topic:'Cash flow', urgency:'Low', time:'Yesterday', status:'answered',
    question:"For the cash flow statement, is depreciation added back because it's a non-cash expense? Or is there another reason?",
    context:"Student mastery: 74% · Sessions on cash flow: 4",
    savedAnswer:"Yes — exactly right. Depreciation is added back to profit in the indirect method because it was deducted to arrive at profit, but it never involved any actual cash leaving the business. The indirect method starts with profit and adjusts for non-cash items to arrive at operating cash flow. Good instinct — you're thinking about this the right way.",
  },
]

export default function LecturerQuestions() {
  const [questions, setQuestions] = useState(QUESTIONS)
  const [selected, setSelected] = useState<typeof QUESTIONS[0]|null>(null)
  const [reply, setReply] = useState('')
  const [saved, setSaved] = useState<number[]>([])

  const sendReply = (id:number) => {
    if (!reply.trim()) return
    setQuestions(prev => prev.map(q => q.id===id ? {...q, status:'answered', savedAnswer:reply} : q))
    setSelected(prev => prev ? {...prev, status:'answered', savedAnswer:reply} : null)
    setReply('')
  }

  const saveToCourse = (id:number) => {
    setSaved(prev => [...prev, id])
    alert('✓ Answer saved to course knowledge base. All SBS 201 students will benefit from this. (Feature L9)')
  }

  const unanswered = questions.filter(q=>q.status==='unanswered')
  const answered   = questions.filter(q=>q.status==='answered')

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden', background:'#F8FAFC' }}>
      {/* List */}
      <div style={{ width:'380px', flexShrink:0, background:'#fff', borderRight:'1px solid #E2E8F0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0' }}>
          <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Student questions (S10 · L6)</div>
          <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Each question arrives with full context from Arthur</div>
          <div style={{ display:'flex', gap:'10px', marginTop:'12px', fontSize:'12px' }}>
            <span className="badge badge-red">{unanswered.length} unanswered</span>
            <span className="badge badge-green">{answered.length} answered</span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {questions.map(q=>(
            <div
              key={q.id}
              onClick={()=>{ setSelected(q); setReply('') }}
              style={{
                padding:'14px 18px', borderBottom:'1px solid #F1F5F9', cursor:'pointer',
                background: selected?.id===q.id ? '#EFF6FF' : 'transparent',
                borderLeft: selected?.id===q.id ? '3px solid #2563EB' : '3px solid transparent',
                transition:'all .15s',
              }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                <span className={`badge ${q.urgency==='High'?'badge-red':q.urgency==='Medium'?'badge-amber':'badge-gray'}`} style={{ fontSize:'10px' }}>
                  {q.urgency} urgency
                </span>
                <span style={{ fontSize:'10px', color:'#94A3B8' }}>{q.time}</span>
              </div>
              <div style={{ fontSize:'12px', fontWeight:500, color:'#0F172A', marginBottom:'3px' }}>
                {q.topic} · <span style={{ fontFamily:'monospace', fontSize:'10px', color:'#94A3B8' }}>{q.studentId}</span>
              </div>
              <p style={{ fontSize:'12px', color:'#64748B', lineHeight:1.4, margin:0,
                overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>
                {q.question}
              </p>
              <div style={{ marginTop:'6px' }}>
                <span className={`badge ${q.status==='answered'?'badge-green':'badge-amber'}`} style={{ fontSize:'10px' }}>
                  {q.status==='answered'?'✓ Answered':'Awaiting reply'}
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
              <span className={`badge ${selected.urgency==='High'?'badge-red':selected.urgency==='Medium'?'badge-amber':'badge-gray'}`}>{selected.urgency} urgency</span>
              <span className="badge badge-blue">{selected.topic}</span>
              <span className="badge badge-gray" style={{ fontFamily:'monospace', fontSize:'10px' }}>{selected.studentId}</span>
              <span style={{ fontSize:'11px', color:'#94A3B8', alignSelf:'center' }}>{selected.time}</span>
            </div>
            <div className="card" style={{ padding:'18px' }}>
              <div style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'8px' }}>Student's question</div>
              <p style={{ fontSize:'14px', color:'#0F172A', lineHeight:1.7, margin:0 }}>{selected.question}</p>
            </div>
          </div>

          {/* Context from Arthur */}
          <div style={{ padding:'14px 16px', background:'#EFF6FF', borderRadius:'10px', border:'1px solid #BFDBFE' }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:'#1D4ED8', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'6px' }}>
              Context Arthur collected (S10)
            </div>
            <p style={{ fontSize:'12px', color:'#1E40AF', lineHeight:1.6, margin:0 }}>{selected.context}</p>
          </div>

          {/* Answer */}
          {selected.status==='answered' && selected.savedAnswer ? (
            <div>
              <div className="card" style={{ padding:'18px', border:'1.5px solid #A7F3D0' }}>
                <div style={{ fontSize:'10px', fontWeight:700, color:'#065F46', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'8px' }}>Your reply</div>
                <p style={{ fontSize:'13px', color:'#0F172A', lineHeight:1.7, margin:0 }}>{selected.savedAnswer}</p>
              </div>
              <div style={{ display:'flex', gap:'10px', marginTop:'12px' }}>
                <button
                  onClick={()=>saveToCourse(selected.id)}
                  disabled={saved.includes(selected.id)}
                  className="btn-primary"
                  style={{ flex:1 }}
                >
                  {saved.includes(selected.id) ? '✓ Saved to course knowledge base' : 'Save answer to course material (L9)'}
                </button>
              </div>
              {saved.includes(selected.id) && (
                <p style={{ fontSize:'12px', color:'#059669', marginTop:'8px', textAlign:'center' }}>
                  ✓ All SBS 201 students now benefit from this answer — it won't be asked again and again.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:'12px', fontWeight:500, color:'#475569', marginBottom:'8px' }}>Your reply</div>
              <textarea
                value={reply}
                onChange={e=>setReply(e.target.value)}
                placeholder="Type your answer here. Strong answers will be offered to save to the course knowledge base for all students (L9)..."
                rows={6}
                style={{
                  width:'100%', padding:'12px 14px', borderRadius:'10px', fontSize:'13px',
                  border:'1.5px solid #E2E8F0', background:'#F8FAFC', color:'#0F172A',
                  fontFamily:'inherit', resize:'vertical', outline:'none', lineHeight:1.6,
                }}
                onFocus={e=>{ e.target.style.borderColor='#93C5FD'; e.target.style.background='#fff' }}
                onBlur={e=>{ e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC' }}
              />
              <div style={{ display:'flex', gap:'10px', marginTop:'12px' }}>
                <button className="btn-ghost" style={{ flex:1 }}>Save draft</button>
                <button onClick={()=>sendReply(selected.id)} className="btn-primary" style={{ flex:2 }} disabled={!reply.trim()}>
                  Send reply to student →
                </button>
              </div>
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
