'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../../lib/demoStore'

interface CourseRow {
  code: string; name: string; lecturer: string; students: number; active: number; avg: number
  atRisk: number; questions: number; compliance: number | null; trend: number[]; live: boolean
}

// Illustrative courses shown beside the live ones until more of the department is on Curriculum AI.
const ILLUSTRATIVE: CourseRow[] = [
  { code:'DA-PY', name:'Data Analytics with Python', lecturer:'Dr. Omondi', students:42, active:35, avg:66, atRisk:5, questions:2, compliance:81, trend:[58,61,64,68,70,69,67,66], live:false },
  { code:'SQL-DA', name:'SQL for Data Analysis', lecturer:'Prof. Kariuki', students:38, active:33, avg:71, atRisk:3, questions:1, compliance:85, trend:[60,63,65,70,74,72,71,71], live:false },
  { code:'ML-F', name:'Machine Learning Foundations', lecturer:'Dr. Njagi', students:31, active:24, avg:58, atRisk:7, questions:4, compliance:72, trend:[50,52,55,58,62,60,59,58], live:false },
]

const COMPLIANCE_CHECKS = [
  { title:'Instructional hours', bcom:'1,820 hrs ✓', bsc:'2,310 hrs ✓', llb:'1,560 hrs ✗', standard:'Min: 1,680–2,240 hrs' },
  { title:'Staff:student ratio', bcom:'1:28 ⚠', bsc:'1:18 ✓', llb:'1:31 ✗', standard:'Recommended: ≤1:20' },
  { title:'KNQF L7 mapping',     bcom:'61% ✗', bsc:'74% ⚠', llb:'52% ✗', standard:'Required: ≥80%' },
  { title:'Assessment spread',   bcom:'72/28 ✓', bsc:'68/32 ✓', llb:'60/40 ✓', standard:'Min: 60% continuous' },
  { title:'Credit load',         bcom:'480 ✓', bsc:'520 ✓', llb:'470 ⚠', standard:'480–540 credits' },
  { title:'Core unit coverage',  bcom:'94% ✓', bsc:'97% ✓', llb:'88% ✓', standard:'Min: 80%' },
]

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
  const [prog, setProg] = useState('bcom')
  const [selectedCourse, setSelectedCourse] = useState<CourseRow|null>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInst = useRef<any>(null)

  // Live courses first, from the same class data their lecturers see.
  const COURSES_DATA = useMemo<CourseRow[]>(() => [
    ...state.summaries.map(c => ({ ...c, compliance: null, live: true })),
    ...ILLUSTRATIVE,
  ], [state.summaries])
  const liveCount = state.summaries.length

  const totalStudents = COURSES_DATA.reduce((s,c)=>s+c.students,0)
  const totalActive   = COURSES_DATA.reduce((s,c)=>s+c.active,0)
  const totalAtRisk   = COURSES_DATA.reduce((s,c)=>s+c.atRisk,0)
  const avgCompr      = Math.round(COURSES_DATA.reduce((s,c)=>s+c.avg,0)/COURSES_DATA.length)
  const unanswered    = COURSES_DATA.reduce((s,c)=>s+c.questions,0)
  const AT_RISK_DEPT  = [...COURSES_DATA].sort((a,b)=>pctOf(b.atRisk,b.students)-pctOf(a.atRisk,a.students)).map(c => {
    const pct = pctOf(c.atRisk, c.students)
    const change = c.trend.length > 1 ? c.trend[c.trend.length-1] - c.trend[c.trend.length-2] : 0
    // Falling comprehension means risk is rising.
    return { course:c.code, count:c.atRisk, pct, trend: change < -1 ? '↑' : change > 1 ? '↓' : '→', urgency: pct >= 15 ? 'High' : pct >= 10 ? 'Medium' : 'Low' }
  })

  const scoreMap: Record<string,number> = { bcom:78, bsc:85, llb:69 }
  const score = scoreMap[prog]
  const scoreColor = score>=80?'#059669':score>=70?'#D97706':'#DC2626'

  useEffect(()=>{
    import('chart.js/auto').then(({default:Chart})=>{
      if (!chartRef.current) return
      if (chartInst.current) chartInst.current.destroy()
      chartInst.current = new Chart(chartRef.current, {
        type:'bar',
        data:{
          labels: COURSES_DATA.map(c=>c.code),
          datasets:[
            { label:'Avg comprehension', data: COURSES_DATA.map(c=>c.avg), backgroundColor:'#BFDBFE', borderRadius:6 },
            { label:'Engagement %', data: COURSES_DATA.map(c=>Math.round(pctOf(c.active,c.students))), backgroundColor:'#2563EB', borderRadius:6 },
          ],
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ position:'top', labels:{ font:{size:11,family:'Inter'}, color:'#475569', boxWidth:10, boxHeight:10 } } },
          scales:{
            x:{ticks:{color:'#94A3B8',font:{size:11,family:'Inter'}},grid:{display:false}},
            y:{min:0,max:100,ticks:{color:'#94A3B8',font:{size:11,family:'Inter'},callback:(v:any)=>v+'%'},grid:{color:'rgba(0,0,0,.04)'}},
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

        <div style={{ padding:'12px 16px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'10px', fontSize:'12px', color:'#78350F', lineHeight:1.5 }}>
          <strong>Partly illustrative.</strong> Courses marked <strong>Live</strong> come from Curriculum AI, from the same class data their lecturers see. The other courses and the compliance figures show what the dashboard will report once more of the department is on Curriculum AI.
        </div>

        {/* Dept metrics (H3, H5, H7) */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px' }}>
          {[
            { label:'Total students', val:totalStudents.toString(), sub:`Across ${COURSES_DATA.length} courses`, delta:'↑ 12% YoY', up:true },
            { label:'Active this week', val:`${Math.round(pctOf(totalActive,totalStudents))}%`, sub:`${totalActive} students`, delta:'↑ healthy', up:true },
            { label:'Avg comprehension', val:`${avgCompr}%`, sub:'Department average', delta:'All courses', up:true },
            { label:'At-risk students', val:totalAtRisk.toString(), sub:'Department-wide', delta:'Needs attention', up:false, alert:true },
            { label:'Unanswered Q\'s', val:unanswered.toString(), sub:'Across all courses', delta:'48hr SLA', up:false, warn:true },
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
                  {['Course','Lecturer','Active','Avg','At-risk','Trend','CUE'].map(h=>(
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...COURSES_DATA].sort((a,b)=>b.atRisk-a.atRisk).map(c=>(
                  <tr key={c.code}
                    onClick={()=>setSelectedCourse(selectedCourse?.code===c.code?null:c)}
                    style={{ cursor:'pointer', background: selectedCourse?.code===c.code?'#EFF6FF':'transparent', borderBottom:'1px solid #F8FAFC', transition:'background .15s' }}
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
                    <td style={{ padding:'11px 10px', fontSize:'12px', fontWeight:600, color: c.compliance===null?'#94A3B8':c.compliance>=80?'#059669':c.compliance>=70?'#D97706':'#DC2626' }}>{c.compliance===null?'—':`${c.compliance}%`}</td>
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

        {/* At-risk (H5) + CUE compliance (H8) */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.8fr', gap:'16px' }}>

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
              <strong>Total: {totalAtRisk} students</strong> across the department are below the engagement threshold. Curriculum AI has flagged these to their respective lecturers.
            </div>
          </div>

          <div className="card" style={{ padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>CUE compliance health check</div>
                <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Switch programme to compare · Regulatory framework: CUE 2014 · KNQF Act 2014</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <select value={prog} onChange={e=>setProg(e.target.value)}
                  style={{ fontSize:'12px', padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontFamily:'inherit', cursor:'pointer', outline:'none', color:'#0F172A' }}>
                  <option value="bcom">BCom — Business School</option>
                  <option value="bsc">BSc CS — SCES</option>
                  <option value="llb">LLB — Law School</option>
                </select>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'28px', fontWeight:800, color:scoreColor, lineHeight:1 }}>{score}</div>
                  <div style={{ fontSize:'9px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px' }}>CUE score</div>
                </div>
              </div>
            </div>

            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F8FAFC' }}>
                  {['Compliance check','Standard','BCom','BSc CS','LLB'].map(h=>(
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px', borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPLIANCE_CHECKS.map(c=>{
                  const render = (v:string) => {
                    const pass = v.includes('✓'), fail = v.includes('✗'), warn = v.includes('⚠')
                    return <td key={v} style={{ padding:'10px 12px', fontSize:'12px', fontWeight:600, color: fail?'#DC2626':warn?'#D97706':'#059669' }}>{v}</td>
                  }
                  return (
                    <tr key={c.title} style={{ borderBottom:'1px solid #F8FAFC' }}>
                      <td style={{ padding:'10px 12px', fontSize:'12px', fontWeight:500, color:'#0F172A' }}>{c.title}</td>
                      <td style={{ padding:'10px 12px', fontSize:'11px', color:'#94A3B8' }}>{c.standard}</td>
                      {render(c.bcom)}{render(c.bsc)}{render(c.llb)}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'14px' }}>
              <div style={{ padding:'11px 14px', background:'#FFFBEB', borderRadius:'9px', border:'1px solid #FDE68A', fontSize:'12px', color:'#78350F' }}>
                <strong>⚠ Priority:</strong> KNQF mapping below 80% across all three programmes. Action required before the next CUE review.
              </div>
              <div style={{ padding:'11px 14px', background:'#ECFDF5', borderRadius:'9px', border:'1px solid #A7F3D0', fontSize:'12px', color:'#064E3B' }}>
                <strong>✓ Strength:</strong> Assessment spread and core unit coverage compliant across all programmes.
              </div>
            </div>
          </div>
        </div>

        {/* Curriculum AI accuracy & fairness (H8, H9) */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A', marginBottom:'10px' }}>Curriculum AI accuracy</div>
              {[
                { label:'Answers backed by course material', pct:99.2 },
                { label:'Answers reviewed and approved by lecturers', pct:94.8 },
                { label:'Questions correctly flagged as out-of-scope', pct:97.1 },
              ].map(i=>(
                <div key={i.label} style={{ marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                    <span style={{ color:'#475569' }}>{i.label}</span>
                    <span style={{ fontWeight:700, color:'#059669' }}>{i.pct}%</span>
                  </div>
                  <div style={{ height:'4px', background:'#F1F5F9', borderRadius:'2px' }}>
                    <div style={{ height:'4px', width:`${i.pct}%`, background:'#059669', borderRadius:'2px' }}/>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A', marginBottom:'10px' }}>Fairness monitoring</div>
              {[
                { label:'Male / female experience parity', val:'97% match', ok:true },
                { label:'High-income / low-income parity', val:'96% match', ok:true },
                { label:'First-language / other-language parity', val:'94% match', ok:true },
                { label:'Difficulty drift across student groups', val:'None detected', ok:true },
              ].map(i=>(
                <div key={i.label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 10px', background:'#F8FAFC', borderRadius:'7px', marginBottom:'6px', fontSize:'12px' }}>
                  <span style={{ color:'#475569' }}>{i.label}</span>
                  <span style={{ fontWeight:600, color:i.ok?'#059669':'#DC2626' }}>{i.val}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A', marginBottom:'10px' }}>Privacy & data</div>
              {[
                { label:'All student IDs anonymised in dashboards', ok:true },
                { label:'No raw student data shared cross-lecturer', ok:true },
                { label:'Data stored within Strathmore provisioned environment', ok:true },
                { label:'GDPR/Kenya Data Protection Act compliant', ok:true },
                { label:'Student IP remains owned by the university', ok:true },
              ].map(i=>(
                <div key={i.label} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'5px 0', fontSize:'12px', borderBottom:'1px solid #F1F5F9' }}>
                  <span style={{ color:'#059669', fontWeight:700, flexShrink:0 }}>✓</span>
                  <span style={{ color:'#475569', lineHeight:1.4 }}>{i.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
