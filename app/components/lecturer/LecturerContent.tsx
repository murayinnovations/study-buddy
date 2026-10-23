'use client'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../lib/demoStore'
import { courseTopics } from '../student/studentData'
import { timeAgo } from '../../lib/format'

const COURSE = 'SBS 201'
const MAX_UPLOAD_CHARS = 40_000

interface CourseMaterial { title: string; type: string; topics: string[] }

const PRACTICE_QUESTIONS = [
  { id:1, q:'What is the difference between straight-line and reducing balance depreciation?', quality:'Good' },
  { id:2, q:'A company buys machinery for KES 240,000. Useful life 4 years, residual value KES 40,000. Calculate Year 2 depreciation using the straight-line method.', quality:'Excellent' },
  { id:3, q:'Prepare the adjustment for rent of KES 15,000 received in advance from a tenant.', quality:'Review needed' },
]

const th: React.CSSProperties = { padding:'9px 12px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', borderBottom:'1px solid #E2E8F0' }
const input: React.CSSProperties = { fontSize:'12px', padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontFamily:'inherit', background:'#fff', color:'#0F172A' }

export default function LecturerContent() {
  const { state, uploadMaterial, approveMaterial, removeMaterial, addGoal, mapGoal, approvePractice } = useStore()
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [newGoal, setNewGoal] = useState<{ goal: string; week: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ title: string; body: string; type: string; topic: string } | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/materials?course=${encodeURIComponent(COURSE)}`)
      .then(r => r.ok ? r.json() : [])
      .then(setMaterials)
      .catch(() => setMaterials([]))
  }, [])

  const uploads = state.uploads.filter(u => u.course === COURSE)
  const savedAnswers = state.questions.filter(q => q.course === COURSE && q.savedToCourse)

  const onFile = async (file: File | undefined) => {
    setUploadError('')
    if (!file) return
    if (!/\.(md|txt)$/i.test(file.name)) { setUploadError('For the demo, upload notes as a .md or .txt file.'); return }
    const body = await file.text()
    if (body.length > MAX_UPLOAD_CHARS) { setUploadError('That file is too long for the demo (40,000 characters max).'); return }
    setPendingFile({ title: file.name.replace(/\.(md|txt)$/i, ''), body, type: 'Lecture notes', topic: courseTopics(COURSE)[0] })
  }

  return (
    <div style={{ overflow:'auto', height:'100%', padding:'20px 24px', background:'#F8FAFC' }}>
      <div style={{ maxWidth:'1000px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'18px' }}>

        {/* Learning goals (L2) */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Learning goals</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>What students are marked against. Curriculum AI teaches towards mapped goals.</div>
            </div>
            {!newGoal && <button onClick={() => setNewGoal({ goal:'', week:'' })} className="btn-primary" style={{ fontSize:'12px', padding:'6px 14px' }}>+ Add goal</button>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {state.goals.map(g=>(
              <div key={g.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 14px', background:'#F8FAFC', borderRadius:'9px', border:'1.5px solid #E2E8F0' }}>
                <div style={{ width:'20px', height:'20px', borderRadius:'50%', background: g.mapped?'#ECFDF5':'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:'11px', color: g.mapped?'#059669':'#DC2626', fontWeight:700 }}>{g.mapped?'✓':'!'}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:500, color:'#0F172A' }}>{g.goal}</div>
                  <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'1px' }}>{g.week} · {g.mapped?'Mapped to Curriculum AI':'Not yet mapped to Curriculum AI'}</div>
                </div>
                {!g.mapped && <button onClick={() => mapGoal(g.id)} className="btn-ghost" style={{ fontSize:'11px', padding:'5px 12px' }}>Map to Curriculum AI</button>}
              </div>
            ))}
            {newGoal && (
              <div style={{ display:'flex', gap:'8px', padding:'11px 14px', background:'#EFF6FF', borderRadius:'9px', border:'1.5px solid #BFDBFE', flexWrap:'wrap' }}>
                <input autoFocus value={newGoal.goal} onChange={e => setNewGoal({ ...newGoal, goal: e.target.value })} placeholder="e.g. Prepare a bank reconciliation statement" style={{ ...input, flex:'1 1 260px' }}/>
                <input value={newGoal.week} onChange={e => setNewGoal({ ...newGoal, week: e.target.value })} placeholder="By Week 10" style={{ ...input, width:'110px' }}/>
                <button onClick={() => { addGoal(newGoal.goal.trim(), newGoal.week.trim() || 'No deadline'); setNewGoal(null) }} disabled={!newGoal.goal.trim()} className="btn-primary" style={{ fontSize:'12px', padding:'6px 14px' }}>Add</button>
                <button onClick={() => setNewGoal(null)} className="btn-ghost" style={{ fontSize:'12px', padding:'6px 12px' }}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Course materials (L1) */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px', gap:'12px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Course material approval</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Nothing reaches students until you approve it. Curriculum AI answers only from approved material.</div>
            </div>
            <button onClick={() => fileRef.current?.click()} className="btn-primary" style={{ fontSize:'12px', padding:'6px 14px', flexShrink:0 }}>Upload material</button>
            <input ref={fileRef} type="file" accept=".md,.txt,text/plain,text/markdown" style={{ display:'none' }}
              onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }}/>
          </div>

          {uploadError && <div style={{ marginBottom:'12px', fontSize:'12px', color:'#B91C1C', background:'#FEF2F2', padding:'8px 12px', borderRadius:'8px' }}>{uploadError}</div>}

          {pendingFile && (
            <div style={{ marginBottom:'14px', padding:'12px 14px', background:'#EFF6FF', borderRadius:'9px', border:'1.5px solid #BFDBFE', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              <input value={pendingFile.title} onChange={e => setPendingFile({ ...pendingFile, title: e.target.value })} style={{ ...input, flex:'1 1 220px' }} aria-label="Title"/>
              <select value={pendingFile.type} onChange={e => setPendingFile({ ...pendingFile, type: e.target.value })} style={input} aria-label="Type">
                {['Lecture notes','Reading list','Past paper','Supplement'].map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={pendingFile.topic} onChange={e => setPendingFile({ ...pendingFile, topic: e.target.value })} style={input} aria-label="Topic">
                {courseTopics(COURSE).map(t => <option key={t}>{t}</option>)}
              </select>
              <button onClick={() => { uploadMaterial({ course: COURSE, title: pendingFile.title.trim() || 'Untitled', type: pendingFile.type, topics: [pendingFile.topic], body: pendingFile.body }); setPendingFile(null) }}
                className="btn-primary" style={{ fontSize:'12px', padding:'6px 14px' }}>Add for review</button>
              <button onClick={() => setPendingFile(null)} className="btn-ghost" style={{ fontSize:'12px', padding:'6px 12px' }}>Cancel</button>
            </div>
          )}

          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Type','Material','Topics covered','Added','Status','Action'].map(h=><th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {uploads.map(m => (
                <tr key={m.id} style={{ borderBottom:'1px solid #F8FAFC', background: m.status === 'pending' ? '#FFFBEB' : 'transparent' }}>
                  <td style={{ padding:'11px 12px' }}><span className="badge badge-gray">{m.type}</span></td>
                  <td style={{ padding:'11px 12px', fontSize:'12px', fontWeight:500, color:'#0F172A', maxWidth:'280px' }}>
                    <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.title}</div>
                  </td>
                  <td style={{ padding:'11px 12px' }}>{m.topics.map(t=><span key={t} className="badge badge-blue" style={{ marginRight:'4px', fontSize:'10px' }}>{t}</span>)}</td>
                  <td style={{ padding:'11px 12px', fontSize:'11px', color:'#94A3B8' }}>{timeAgo(m.uploadedAt)}</td>
                  <td style={{ padding:'11px 12px' }}>
                    <span className={`badge ${m.status==='approved'?'badge-green':'badge-amber'}`}>{m.status==='approved'?'✓ Approved':'Pending review'}</span>
                  </td>
                  <td style={{ padding:'11px 12px', display:'flex', gap:'6px' }}>
                    {m.status==='pending' && <button onClick={()=>approveMaterial(m.id)} className="btn-primary" style={{ fontSize:'11px', padding:'5px 12px' }}>Approve</button>}
                    <button onClick={()=>removeMaterial(m.id)} className="btn-ghost" style={{ fontSize:'11px', padding:'5px 12px' }}>Remove</button>
                  </td>
                </tr>
              ))}
              {savedAnswers.map(q => (
                <tr key={q.id} style={{ borderBottom:'1px solid #F8FAFC' }}>
                  <td style={{ padding:'11px 12px' }}><span className="badge badge-gray">Lecturer answer</span></td>
                  <td style={{ padding:'11px 12px', fontSize:'12px', fontWeight:500, color:'#0F172A', maxWidth:'280px' }}>
                    <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{q.question}</div>
                  </td>
                  <td style={{ padding:'11px 12px' }}><span className="badge badge-blue" style={{ fontSize:'10px' }}>{q.topic}</span></td>
                  <td style={{ padding:'11px 12px', fontSize:'11px', color:'#94A3B8' }}>{q.repliedAt ? timeAgo(q.repliedAt) : 'Earlier'}</td>
                  <td style={{ padding:'11px 12px' }}><span className="badge badge-green">✓ Approved</span></td>
                  <td style={{ padding:'11px 12px', fontSize:'11px', color:'#94A3B8' }}>From your inbox</td>
                </tr>
              ))}
              {materials.map(m => (
                <tr key={m.title} style={{ borderBottom:'1px solid #F8FAFC' }}>
                  <td style={{ padding:'11px 12px' }}><span className="badge badge-gray">{m.type}</span></td>
                  <td style={{ padding:'11px 12px', fontSize:'12px', fontWeight:500, color:'#0F172A', maxWidth:'280px' }}>
                    <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.title}</div>
                  </td>
                  <td style={{ padding:'11px 12px' }}>{m.topics.map(t=><span key={t} className="badge badge-blue" style={{ marginRight:'4px', fontSize:'10px' }}>{t}</span>)}</td>
                  <td style={{ padding:'11px 12px', fontSize:'11px', color:'#94A3B8' }}>Start of semester</td>
                  <td style={{ padding:'11px 12px' }}><span className="badge badge-green">✓ Approved</span></td>
                  <td style={{ padding:'11px 12px', fontSize:'11px', color:'#94A3B8' }}>In use by Curriculum AI</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Practice questions (L10) */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ marginBottom:'14px' }}>
            <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Curriculum AI&apos;s practice questions</div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Review and approve questions for the shared question bank.</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {PRACTICE_QUESTIONS.map(q => {
              const approved = state.approvedPracticeIds.includes(q.id)
              return (
                <div key={q.id} style={{ padding:'14px', borderRadius:'10px', background:'#F8FAFC', border:`1.5px solid ${approved?'#A7F3D0':'#FDE68A'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                    <p style={{ fontSize:'13px', color:'#0F172A', lineHeight:1.6, margin:0, flex:1 }}>{q.q}</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end', flexShrink:0 }}>
                      <span className={`badge ${q.quality==='Excellent'?'badge-green':q.quality==='Good'?'badge-blue':'badge-amber'}`}>{q.quality}</span>
                      {approved
                        ? <span className="badge badge-green">✓ Approved</span>
                        : <button onClick={()=>approvePractice(q.id)} className="btn-primary" style={{ fontSize:'11px', padding:'5px 12px' }}>Approve</button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
