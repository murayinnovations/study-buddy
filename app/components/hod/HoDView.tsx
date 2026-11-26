'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../../lib/demoStore'

interface CourseRow {
  code: string; name: string; lecturer: string; students: number; active: number; avg: number
  atRisk: number; questions: number; compliance: number | null; trend: number[]; live: boolean
}

const pctOf = (n: number, of: number) => (of ? Math.round(n / of * 1000) / 10 : 0)

function MiniSparkline({ data, color }: { data:number[]; color:string }) {
  const max = Math.max(...data), min = Math.min(...data)
  const w = 80, h = 28
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h-((v-min)/(max-min||1))*(h-4)-2}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

export default function HoDView() {
  const { state, member } = useStore()
  const [selectedCourse, setSelectedCourse] = useState<CourseRow|null>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInst = useRef<any>(null)

  // Live courses only, from the same class data their lecturers see.
  const COURSES_DATA = useMemo<CourseRow[]>(() => [
    ...state.summaries.map(c => ({ ...c, compliance: null, live: true })),
  ], [state.summaries])
  const liveCount = state.summaries.length

  const totalStudents = COURSES_DATA.reduce((s,c)=>s+c.students,0)
  const totalActive   = COURSES_DATA.reduce((s,c)=>s+c.active,0)
  const totalAtRisk   = COURSES_DATA.reduce((s,c)=>s+c.atRisk,0)
  const avgCompr      = COURSES_DATA.length ? Math.round(COURSES_DATA.reduce((s,c)=>s+c.avg,0)/COURSES_DATA.length) : 0
  const unanswered    = COURSES_DATA.reduce((s,c)=>s+c.questions,0)
  const AT_RISK_DEPT  = [...COURSES_DATA].sort((a,b)=>pctOf(b.atRisk,b.students)-pctOf(a.atRisk,a.students)).map(c => {
    const pct = pctOf(c.atRisk, c.students)
    const change = c.trend.length > 1 ? c.trend[c.trend.length-1] - c.trend[c.trend.length-2] : 0
    // Falling comprehension means risk is rising.
    return { course:c.code, count:c.atRisk, pct, trend: change < -1 ? '↑' : change > 1 ? '↓' : '→', urgency: pct >= 15 ? 'High' : pct >= 10 ? 'Medium' : 'Low' }
  })


  useEffect(()=>{
    import('chart.js/auto').then(({default:Chart})=>{
      if (!chartRef.current) return
      if (chartInst.current) chartInst.current.destroy()
      chartInst.current = new Chart(chartRef.current, {
        type:'bar',
        data:{
          labels: COURSES_DATA.map(c=>c.code),
          datasets:[
            { label:'Avg comprehension', data: COURSES_DATA.map(c=>c.avg), backgroundColor:'#D3D9E6', borderRadius:6 },
            { label:'Engagement %', data: COURSES_DATA.map(c=>Math.round(pctOf(c.active,c.students))), backgroundColor:'#0D1B3D', borderRadius:6 },
          ],
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ position:'top', labels:{ font:{size:11,family:'Poppins'}, color:'#475569', boxWidth:10, boxHeight:10 } } },
          scales:{
            x:{ticks:{color:'#94A3B8',font:{size:11,family:'Poppins'}},grid:{display:false}},
            y:{min:0,max:100,ticks:{color:'#94A3B8',font:{size:11,family:'Poppins'},callback:(v:any)=>v+'%'},grid:{color:'rgba(0,0,0,.04)'}},
          },
        },
      })
    })
    return ()=>{ if(chartInst.current) chartInst.current.destroy() }
  }, [COURSES_DATA])

  return (
    <div style={{ overflow:'auto', height:'100%', padding:'20px 24px', background:'#F8FAFC' }}>
      <div style={{ maxWidth:'1160px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'18px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h1 style={{ fontSize:'16px', fontWeight:700, color:'#0F172A', margin:0 }}>Department Overview</h1>
            <p style={{ fontSize:'12px', color:'#94A3B8', margin:'3px 0 0' }}>{member.subtitle} · {member.name} · Current semester</p>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <span className="badge badge-blue">{COURSES_DATA.length} courses · {liveCount} live</span>
            <span className="badge badge-amber">{unanswered} unanswered student questions</span>
          </div>
        </div>


        {/* Dept metrics (H3, H5, H7) */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px' }}>
          {[
            { label:'Total students', val:totalStudents.toString(), sub:`Across ${COURSES_DATA.length} courses`, delta:'Live courses', up:true },
            { label:'Active this week', val:`${Math.round(pctOf(totalActive,totalStudents))}%`, sub:`${totalActive} students`, delta:'Last 7 days', up:true },
            { label:'Avg comprehension', val:`${avgCompr}%`, sub:'Department average', delta:'All courses', up:true },
            { label:'At-risk students', val:totalAtRisk.toString(), sub:'Department-wide', delta:'Needs attention', up:false, alert:true },
            { label:'Unanswered Q\'s', val:unanswered.toString(), sub:'Across all courses', delta:'Awaiting a reply', up:false, warn:true },
          ].map(m=>(
            <div key={m.label} className="metric">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ fontSize:'24px', color: m.alert?'#DC2626':m.warn?'#D97706':'#0F172A' }}>{m.val}</div>
              <div className="metric-sub">{m.sub}</div>
              <div className="metric-delta" style={{ color: m.up?'#059669':m.warn?'#D97706':'#DC2626' }}>{m.delta}</div>
            </div>
          ))}
        </div>

        {/* Course table (H3, H4) + chart */}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:'16px' }}>
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A', marginBottom:'4px' }}>Course performance</div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginBottom:'14px' }}>Click a row to drill in · Sorted by at-risk count</div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Course','Lecturer','Active','Avg','At-risk','Trend'].map(h=>(
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...COURSES_DATA].sort((a,b)=>b.atRisk-a.atRisk).map(c=>(
                  <tr key={c.code}
                    onClick={()=>setSelectedCourse(selectedCourse?.code===c.code?null:c)}
                    style={{ cursor:'pointer', background: selectedCourse?.code===c.code?'#F1F3F8':'transparent', borderBottom:'1px solid #F8FAFC', transition:'background .15s' }}
                    onMouseEnter={e=>{if(selectedCourse?.code!==c.code)(e.currentTarget as HTMLElement).style.background='#F8FAFC'}}
                    onMouseLeave={e=>{if(selectedCourse?.code!==c.code)(e.currentTarget as HTMLElement).style.background='transparent'}}
                  >
                    <td style={{ padding:'11px 10px' }}>
                      <div style={{ fontSize:'12px', fontWeight:600, color:'#0F172A' }}>{c.code}{c.live && <span className="badge badge-green" style={{ fontSize:'9px', marginLeft:'6px' }}>Live</span>}</div>
                      <div style={{ fontSize:'10px', color:'#94A3B8' }}>{c.name}</div>
                    </td>
                    <td style={{ padding:'11px 10px', fontSize:'11px', color:'#475569' }}>{c.lecturer}</td>
                    <td style={{ padding:'11px 10px', fontSize:'12px', color:'#475569' }}>{Math.round(pctOf(c.active,c.students))}%</td>
                    <td style={{ padding:'11px 10px', fontSize:'12px', fontWeight:600, color: c.avg>=70?'#059669':c.avg>=60?'#D97706':'#DC2626' }}>{c.avg}%</td>
                    <td style={{ padding:'11px 10px' }}>
                      <span className={`badge ${pctOf(c.atRisk,c.students)>=15?'badge-red':pctOf(c.atRisk,c.students)>=10?'badge-amber':'badge-green'}`}>{c.atRisk}</span>
                    </td>
                    <td style={{ padding:'11px 10px' }}><MiniSparkline data={c.trend} color={c.avg>=65?'#059669':'#D97706'}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A', marginBottom:'4px' }}>Comprehension vs engagement</div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginBottom:'14px' }}>Cross-course comparison · This semester</div>
            <div style={{ position:'relative', height:'220px' }}>
              <canvas ref={chartRef} role="img" aria-label={`Bar chart comparing comprehension and engagement across ${COURSES_DATA.length} courses`}/>
            </div>
          </div>
        </div>

        {/* Course drill-in (H4) */}
        {selectedCourse && (
          <div className="card fade-up" style={{ padding:'20px', display:'grid', gridTemplateColumns:'1.2fr repeat(4,1fr)', gap:'16px', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'15px', fontWeight:700, color:'#0F172A' }}>{selectedCourse.code} · {selectedCourse.name}</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>{selectedCourse.lecturer}</div>
              <button onClick={() => setSelectedCourse(null)} className="btn-ghost" style={{ fontSize:'11px', padding:'4px 10px', marginTop:'10px' }}>Close</button>
            </div>
            {[
              { label:'Enrolled', val:`${selectedCourse.students}`, sub:`${selectedCourse.active} active this week` },
              { label:'Avg comprehension', val:`${selectedCourse.avg}%`, sub:`Peak ${Math.max(...selectedCourse.trend)}% this semester` },
              { label:'At-risk students', val:`${selectedCourse.atRisk}`, sub:`${pctOf(selectedCourse.atRisk, selectedCourse.students)}% of enrolled` },
              { label:'Unanswered questions', val:`${selectedCourse.questions}`, sub:'Target: reply within 48 hours' },
            ].map(m => (
              <div key={m.label} className="metric">
                <div className="metric-label">{m.label}</div>
                <div className="metric-value" style={{ fontSize:'22px' }}>{m.val}</div>
                <div className="metric-sub">{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* At-risk (H5) */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'16px' }}>

          <div className="card" style={{ padding:'20px' }}>
            <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A', marginBottom:'4px' }}>At-risk students by course</div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginBottom:'14px' }}>Department-wide early warning</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {AT_RISK_DEPT.map(r=>(
                <div key={r.course} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 14px', background:'#F8FAFC', borderRadius:'9px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:600, color:'#0F172A' }}>{r.course}</div>
                    <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'1px' }}>{r.pct}% of enrolled</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'18px', fontWeight:700, color: r.urgency==='High'?'#DC2626':r.urgency==='Medium'?'#D97706':'#059669' }}>{r.count}</div>
                    <span className={`badge ${r.urgency==='High'?'badge-red':r.urgency==='Medium'?'badge-amber':'badge-green'}`} style={{ fontSize:'10px' }}>{r.urgency}</span>
                  </div>
                  <span style={{ fontSize:'14px', fontWeight:700, color: r.trend==='↑'?'#DC2626':r.trend==='↓'?'#059669':'#94A3B8' }}>{r.trend}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'14px', padding:'11px 14px', background:'#FEF2F2', borderRadius:'9px', border:'1px solid #FECACA', fontSize:'12px', color:'#7F1D1D' }}>
              <strong>Total: {totalAtRisk} students</strong> across the department are below the engagement threshold. Their lecturers see them in their own class view.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
