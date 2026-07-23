'use client'
import { useEffect, useRef } from 'react'

const HEAT = [
  { topic:'Depreciation',           pct:63, level:5 },
  { topic:'Accruals & prepayments', pct:47, level:4 },
  { topic:'Trial balance errors',   pct:41, level:4 },
  { topic:'Income statement',       pct:35, level:3 },
  { topic:'Cash flow stmt',         pct:31, level:3 },
  { topic:'Double-entry',           pct:22, level:2 },
  { topic:'Ledger posting',         pct:18, level:2 },
  { topic:'Accounting equation',    pct:11, level:1 },
]

const BRIEF = [
  { rank:1, topic:'Depreciation methods', desc:'63% confusion — straight-line vs reducing balance. 38 students asked variants this week.', time:'20 min' },
  { rank:2, topic:'Accruals & prepayments', desc:'Timing confusion: recognition vs cash. Top misconception: all expenses = cash outflow.', time:'15 min' },
  { rank:3, topic:'Trial balance errors', desc:'Students struggling to find omission errors. Worked example recommended.', time:'10 min' },
  { rank:4, topic:'Open Q&A', desc:'Buffer for emerging questions.', time:'15 min' },
]

const heatClass: Record<number,string> = {5:'heat-5',4:'heat-4',3:'heat-3',2:'heat-2',1:'heat-1'}

export default function LecturerOverview() {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInst = useRef<any>(null)

  useEffect(() => {
    import('chart.js/auto').then(({default:Chart}) => {
      if (!chartRef.current) return
      if (chartInst.current) chartInst.current.destroy()
      chartInst.current = new Chart(chartRef.current, {
        type:'line',
        data:{
          labels:['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6','Wk 7','Wk 8'],
          datasets:[{
            label:'Comprehension %',
            data:[55,58,61,67,72,68,65,64],
            borderColor:'#2563EB', backgroundColor:'rgba(37,99,235,.07)',
            borderWidth:2.5, pointBackgroundColor:'#2563EB', pointRadius:5,
            tension:.4, fill:true,
          }],
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'#1E3A5F', titleColor:'#fff', bodyColor:'#93C5FD', padding:10 } },
          scales:{
            x:{ticks:{color:'#94A3B8',font:{size:11,family:'Inter'}},grid:{color:'rgba(0,0,0,.04)'}},
            y:{min:40,max:85,ticks:{color:'#94A3B8',font:{size:11,family:'Inter'},callback:(v:any)=>v+'%'},grid:{color:'rgba(0,0,0,.04)'}},
          },
        },
      })
    })
    return () => { if(chartInst.current) chartInst.current.destroy() }
  }, [])

  return (
    <div style={{ overflow:'auto', height:'100%', padding:'20px 24px', background:'#F8FAFC' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'18px' }}>

        {/* Metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px' }}>
          {[
            { label:'Active students', val:'214', sub:'of 247 enrolled', delta:'↑ 18 this week', up:true },
            { label:'Avg comprehension', val:'64%', sub:'Across all topics', delta:'↓ 3% from last week', up:false },
            { label:'At-risk students', val:'12', sub:'< 40% engagement', delta:'↑ 4 flagged', up:false, alert:true },
            { label:'Top confusion', val:'Depreciation', sub:'63% confusion rate', delta:'⚠ Needs focus', up:false, warn:true },
          ].map(m => (
            <div key={m.label} className="metric">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ fontSize: m.val.length>5?'18px':'28px', color: m.alert?'#DC2626':'#0F172A' }}>{m.val}</div>
              <div className="metric-sub">{m.sub}</div>
              <div className="metric-delta" style={{ color: m.up?'#059669':m.warn?'#D97706':'#DC2626' }}>{m.delta}</div>
            </div>
          ))}
        </div>

        {/* Heatmap + Brief */}
        <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:'16px' }}>
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Topic comprehension map (L5)</div>
                <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Week 8 · 214 student interactions · Anonymised</div>
              </div>
              <span className="badge badge-amber">⚠ 3 need attention</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {HEAT.map(h => (
                <div key={h.topic} className={`${heatClass[h.level]}`} style={{ padding:'10px 8px', borderRadius:'9px', cursor:'pointer', transition:'transform .15s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.04)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='scale(1)'}
                >
                  <div style={{ fontSize:'11px', fontWeight:500, marginBottom:'4px', lineHeight:1.2 }}>{h.topic}</div>
                  <div style={{ fontSize:'20px', fontWeight:700 }}>{h.pct}%</div>
                  <div style={{ fontSize:'10px', opacity:.7 }}>confusion</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'12px', marginTop:'12px', fontSize:'11px', color:'#94A3B8' }}>
              {[['#FEE2E2','High'],['#FEF3C7','Moderate'],['#D1FAE5','Low']].map(([bg,l])=>(
                <span key={l} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <span style={{ width:'10px', height:'10px', borderRadius:'2px', background:bg, display:'inline-block' }}/>
                  {l} confusion
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Auto session brief (L5)</div>
                <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Thu 9 May · Tutorial 08</div>
              </div>
              <span className="badge badge-blue">AI-generated</span>
            </div>
            {BRIEF.map((b,i)=>(
              <div key={b.rank} style={{ display:'flex', gap:'10px', padding:'10px 0', borderTop: i>0?'1px solid #F1F5F9':'none' }}>
                <span style={{ fontSize:'11px', fontWeight:700, color:'#CBD5E1', width:'18px', flexShrink:0, marginTop:'1px' }}>#{b.rank}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:500, color:'#0F172A' }}>{b.topic}</div>
                  <div style={{ fontSize:'11px', color:'#64748B', marginTop:'2px', lineHeight:1.4 }}>{b.desc}</div>
                </div>
                <span className="badge badge-teal" style={{ alignSelf:'flex-start', flexShrink:0 }}>{b.time}</span>
              </div>
            ))}
            <div style={{ marginTop:'12px', padding:'10px 12px', background:'#EFF6FF', borderRadius:'8px', fontSize:'11px', color:'#1D4ED8', fontWeight:500 }}>
              ✦ 60 min total · Built from 214 student interactions
            </div>
          </div>
        </div>

        {/* Trend + L12 insight */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Weekly comprehension trend (L12)</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>SBS 201 · Weeks 1–8 · What worked, what confused students</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'24px', alignItems:'center' }}>
            <div style={{ position:'relative', height:'180px' }}>
              <canvas ref={chartRef} role="img" aria-label="Comprehension trend: rises from 55% to 72%, dips to 64% in weeks 6-8"/>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ padding:'12px', background:'#FEF3C7', borderRadius:'10px', border:'1px solid #FDE68A' }}>
                <div style={{ fontSize:'10px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>Arthur insight</div>
                <p style={{ fontSize:'12px', color:'#78350F', lineHeight:1.5, margin:0 }}>
                  Comprehension peaked at 72% (Week 5) then dipped with introduction of depreciation. Students who studied &gt;3 sessions show 18% higher retention.
                </p>
              </div>
              <div style={{ padding:'12px', background:'#ECFDF5', borderRadius:'10px', border:'1px solid #A7F3D0' }}>
                <div style={{ fontSize:'10px', fontWeight:700, color:'#065F46', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>What worked (L12)</div>
                <p style={{ fontSize:'12px', color:'#064E3B', lineHeight:1.5, margin:0 }}>
                  Worked examples with Kenyan company data (Safaricom, Equity Bank) generated 3× more follow-up sessions than textbook exercises.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
