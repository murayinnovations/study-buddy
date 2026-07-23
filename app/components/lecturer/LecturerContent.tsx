'use client'
import { useState } from 'react'

const MATERIALS = [
  { id:1, type:'Lecture notes', name:'Week 6 — Depreciation Methods.pdf', status:'approved', topics:['Depreciation'], lastReviewed:'3 days ago' },
  { id:2, type:'Reading list',  name:'IAS 16 — Property, Plant & Equipment (IFRS Foundation)', status:'approved', topics:['Depreciation','Balance sheet'], lastReviewed:'1 week ago' },
  { id:3, type:'Past paper',   name:'2023 SBS 201 End of Semester Exam', status:'approved', topics:['All topics'], lastReviewed:'2 weeks ago' },
  { id:4, type:'Lecture notes', name:'Week 8 — Accruals & Prepayments.pdf', status:'pending', topics:['Accruals & prepayments'], lastReviewed:'Awaiting review' },
  { id:5, type:'Supplement',   name:'Equity Bank Annual Report 2023 — Extracts', status:'pending', topics:['Financial statements'], lastReviewed:'Awaiting review' },
]

const QUESTIONS = [
  { id:1, q:'What is the difference between straight-line and reducing balance depreciation?', source:'Arthur-generated', quality:'Good', approved:true },
  { id:2, q:'A company buys machinery for KES 240,000. Useful life 4 years, residual value KES 40,000. Calculate Year 2 depreciation using the straight-line method.', source:'Arthur-generated', quality:'Excellent', approved:true },
  { id:3, q:'Prepare the accruals adjustment for rent received in advance of KES 15,000.', source:'Arthur-generated', quality:'Review needed', approved:false },
]

const GOALS = [
  { id:1, goal:'Prepare financial statements in accordance with IFRS', week:'By Week 10', mapped:true },
  { id:2, goal:'Apply the matching concept to accruals and prepayments', week:'By Week 8', mapped:true },
  { id:3, goal:'Calculate depreciation using both methods and explain the choice', week:'By Week 7', mapped:false },
]

export default function LecturerContent() {
  const [materials, setMaterials] = useState(MATERIALS)
  const [questions, setQuestions] = useState(QUESTIONS)

  const approve = (id:number) => setMaterials(m=>m.map(x=>x.id===id?{...x,status:'approved',lastReviewed:'Just now'}:x))
  const approveQ = (id:number) => setQuestions(q=>q.map(x=>x.id===id?{...x,approved:true}:x))

  return (
    <div style={{ overflow:'auto', height:'100%', padding:'20px 24px', background:'#F8FAFC' }}>
      <div style={{ maxWidth:'1000px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'18px' }}>

        {/* Learning goals (L2) */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Learning goals (L2)</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Arthur teaches towards these goals — what students are marked against</div>
            </div>
            <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 14px' }}>+ Add goal</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {GOALS.map(g=>(
              <div key={g.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 14px', background:'#F8FAFC', borderRadius:'9px', border:'1.5px solid #E2E8F0' }}>
                <div style={{ width:'20px', height:'20px', borderRadius:'50%', background: g.mapped?'#ECFDF5':'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:'11px', color: g.mapped?'#059669':'#DC2626', fontWeight:700 }}>{g.mapped?'✓':'!'}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:500, color:'#0F172A' }}>{g.goal}</div>
                  <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'1px' }}>{g.week} · {g.mapped?'Mapped to Arthur':'Not yet mapped to Arthur'}</div>
                </div>
                {!g.mapped && <button className="btn-ghost" style={{ fontSize:'11px', padding:'5px 12px' }}>Map to Arthur</button>}
              </div>
            ))}
          </div>
        </div>

        {/* Course materials (L1) */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Course material approval (L1 · S8)</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Nothing reaches students until you approve it. You stay in charge of what Arthur teaches.</div>
            </div>
            <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 14px' }}>Upload material</button>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Type','Material','Topics covered','Last reviewed','Status','Action'].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materials.map(m=>(
                <tr key={m.id} style={{ borderBottom:'1px solid #F8FAFC' }}>
                  <td style={{ padding:'11px 12px' }}><span className="badge badge-gray">{m.type}</span></td>
                  <td style={{ padding:'11px 12px', fontSize:'12px', fontWeight:500, color:'#0F172A', maxWidth:'280px' }}>
                    <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
                  </td>
                  <td style={{ padding:'11px 12px' }}>
                    {m.topics.map(t=><span key={t} className="badge badge-blue" style={{ marginRight:'4px', fontSize:'10px' }}>{t}</span>)}
                  </td>
                  <td style={{ padding:'11px 12px', fontSize:'11px', color:'#94A3B8' }}>{m.lastReviewed}</td>
                  <td style={{ padding:'11px 12px' }}>
                    <span className={`badge ${m.status==='approved'?'badge-green':'badge-amber'}`}>
                      {m.status==='approved'?'✓ Approved':'Pending review'}
                    </span>
                  </td>
                  <td style={{ padding:'11px 12px' }}>
                    {m.status==='pending'
                      ? <button onClick={()=>approve(m.id)} className="btn-primary" style={{ fontSize:'11px', padding:'5px 12px' }}>Approve</button>
                      : <button className="btn-ghost" style={{ fontSize:'11px', padding:'5px 12px' }}>Edit scope</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Practice questions (L10) */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Arthur's practice questions (L10)</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Review, edit, or approve before students see them. You control quality.</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {questions.map(q=>(
              <div key={q.id} style={{ padding:'14px', borderRadius:'10px', background:'#F8FAFC', border:`1.5px solid ${q.approved?'#A7F3D0':'#FDE68A'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                  <p style={{ fontSize:'13px', color:'#0F172A', lineHeight:1.6, margin:0, flex:1 }}>{q.q}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end', flexShrink:0 }}>
                    <span className={`badge ${q.quality==='Excellent'?'badge-green':q.quality==='Good'?'badge-blue':'badge-amber'}`}>{q.quality}</span>
                    {q.approved
                      ? <span className="badge badge-green">✓ Approved</span>
                      : <button onClick={()=>approveQ(q.id)} className="btn-primary" style={{ fontSize:'11px', padding:'5px 12px' }}>Approve</button>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
