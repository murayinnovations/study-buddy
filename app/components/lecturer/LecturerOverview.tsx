'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, type BriefItem } from '../../lib/demoStore'
import { buildCohort, SYNTHETIC_COUNT, topicStats, TREND_HISTORY } from '../../lib/cohort'
import { CURRENT_WEEK } from '../student/studentData'
import { average, timeAgo } from '../../lib/format'

const COURSE = 'SBS 201'

const heatLevel = (confusion: number) => confusion >= 50 ? 5 : confusion >= 40 ? 4 : confusion >= 30 ? 3 : confusion >= 20 ? 2 : 1

export default function LecturerOverview() {
  const { state, saveBrief } = useStore()
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInst = useRef<any>(null)
  const [briefState, setBriefState] = useState<'idle' | 'loading' | 'error'>('idle')

  const cohort = useMemo(() => buildCohort(state.students), [state.students])
  const stats = useMemo(() => topicStats(cohort), [cohort])
  const misconceptions = state.misconceptions.filter(m => m.course === COURSE)
  const questions = state.questions.filter(q => q.course === COURSE)

  const active = cohort.filter(s => s.daysAgo <= 7).length
  const classAvg = average(cohort.map(s => s.score))
  const atRisk = cohort.filter(s => s.status === 'Critical' || s.status === 'At risk').length
  const top = stats[0]

  // Students who use Curriculum AI more vs less, for the insight card.
  const frequent = cohort.filter(s => s.sessions >= 10)
  const occasional = cohort.filter(s => s.sessions < 10)

  const defaultBrief: BriefItem[] = [
    ...stats.slice(0, 3).map((t, i) => ({
      topic: t.topic,
      focus: `${t.confusion}% of students are below 50% mastery · class average ${t.avg}%.`,
      minutes: [20, 15, 10][i],
    })),
    { topic: 'Open Q&A', focus: `Buffer for emerging questions (${questions.filter(q => !q.reply).length} unanswered in your inbox).`, minutes: 15 },
  ]
  // The class data a brief is drafted from. The saved brief keeps the version it
  // used, so we can say when it's out of date instead of redrafting automatically.
  const briefInput = {
    course: COURSE,
    week: CURRENT_WEEK,
    topics: stats,
    misconceptions: misconceptions.slice(0, 15).map(m => `${m.topic}: ${m.note}`),
    questions: questions.slice(0, 10).map(q => `${q.topic}: ${q.question}`.slice(0, 1000)),
  }
  const signature = JSON.stringify(briefInput)
  const saved = state.briefs[COURSE]
  const outOfDate = !!saved && saved.signature !== signature
  const shownBrief = saved?.items || defaultBrief

  const draftBrief = async () => {
    setBriefState('loading')
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Unchanged data plus a click means "give me a new draft"; otherwise the server may reuse one.
        body: JSON.stringify({ ...briefInput, refresh: saved?.signature === signature }),
      })
      if (!res.ok) throw new Error(`brief failed: ${res.status}`)
      const data = await res.json()
      saveBrief(COURSE, { items: data.items, generatedAt: data.generatedAt, signature })
      setBriefState('idle')
    } catch {
      setBriefState('error')
    }
  }

  useEffect(() => {
    import('chart.js/auto').then(({default:Chart}) => {
      if (!chartRef.current) return
      if (chartInst.current) chartInst.current.destroy()
      const data = [...TREND_HISTORY, classAvg]
      chartInst.current = new Chart(chartRef.current, {
        type:'line',
        data:{
          labels: data.map((_, i) => `Wk ${i + 1}`),
          datasets:[{
            label:'Comprehension %',
            data,
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
  }, [classAvg])

  return (
    <div style={{ overflow:'auto', height:'100%', padding:'20px 24px', background:'#F8FAFC' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'18px' }}>

        <div style={{ fontSize:'11px', color:'#94A3B8' }}>
          Class: {cohort.length - SYNTHETIC_COUNT} signed-up student{cohort.length - SYNTHETIC_COUNT === 1 ? '' : 's'}, whose activity updates these figures live, plus {SYNTHETIC_COUNT} synthetic students while the pilot is small.
        </div>

        {/* Metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px' }}>
          {[
            { label:'Active students', val:`${active}`, sub:`of ${cohort.length} in the class · last 7 days` },
            { label:'Avg comprehension', val:`${classAvg}%`, sub:`Topics taught to Week ${CURRENT_WEEK}` },
            { label:'At-risk students', val:`${atRisk}`, sub:'Critical or at risk', alert:true },
            { label:'Top confusion', val: top.topic, sub:`${top.confusion}% below 50% mastery`, warn:true },
          ].map(m => (
            <div key={m.label} className="metric">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ fontSize: m.val.length>5?'18px':'28px', color: m.alert?'#DC2626':m.warn?'#D97706':'#0F172A' }}>{m.val}</div>
              <div className="metric-sub">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Heatmap + Brief */}
        <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:'16px' }}>
          <div className="card" style={{ padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Topic comprehension map (L5)</div>
                <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Share of students below 50% mastery · Anonymised</div>
              </div>
              <span className="badge badge-amber">⚠ {stats.filter(t => t.confusion >= 40).length} need attention</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {stats.map(h => (
                <div key={h.topic} className={`heat-${heatLevel(h.confusion)}`} style={{ padding:'10px 8px', borderRadius:'9px' }}>
                  <div style={{ fontSize:'11px', fontWeight:500, marginBottom:'4px', lineHeight:1.2 }}>{h.topic}</div>
                  <div style={{ fontSize:'20px', fontWeight:700 }}>{h.confusion}%</div>
                  <div style={{ fontSize:'10px', opacity:.7 }}>confused · avg {h.avg}%</div>
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
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px', gap:'8px' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Session brief (L5)</div>
                <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>Next tutorial · Week {CURRENT_WEEK}</div>
              </div>
              <button onClick={draftBrief} disabled={briefState === 'loading'} className="btn-ghost" style={{ fontSize:'11px', padding:'5px 10px', flexShrink:0 }}>
                {briefState === 'loading' ? 'Drafting…' : saved ? '↻ Refresh' : '✦ Draft with Curriculum AI'}
              </button>
            </div>
            {shownBrief.map((b,i)=>(
              <div key={i} style={{ display:'flex', gap:'10px', padding:'10px 0', borderTop: i>0?'1px solid #F1F5F9':'none' }}>
                <span style={{ fontSize:'11px', fontWeight:700, color:'#CBD5E1', width:'18px', flexShrink:0, marginTop:'1px' }}>#{i+1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:500, color:'#0F172A' }}>{b.topic}</div>
                  <div style={{ fontSize:'11px', color:'#64748B', marginTop:'2px', lineHeight:1.4 }}>{b.focus}</div>
                </div>
                <span className="badge badge-teal" style={{ alignSelf:'flex-start', flexShrink:0 }}>{b.minutes} min</span>
              </div>
            ))}
            <div style={{ marginTop:'12px', padding:'10px 12px', background: briefState === 'error' ? '#FEF2F2' : outOfDate && briefState !== 'loading' ? '#FFFBEB' : '#EFF6FF', borderRadius:'8px', fontSize:'11px', color: briefState === 'error' ? '#B91C1C' : outOfDate && briefState !== 'loading' ? '#92400E' : '#1D4ED8', fontWeight:500 }}>
              {briefState === 'loading'
                ? '✦ Curriculum AI is drafting from class mastery, misconceptions and student questions. This takes about 20–30 seconds.'
                : briefState === 'error'
                ? saved ? 'Curriculum AI could not refresh the brief. Showing the last draft.' : 'Curriculum AI could not draft the brief. Showing the plan built from class data.'
                : saved
                  ? outOfDate
                    ? `Drafted ${timeAgo(saved.generatedAt).toLowerCase()}. Class data has changed since; refresh to update it.`
                    : `✦ Drafted by Curriculum AI ${timeAgo(saved.generatedAt).toLowerCase()} from class mastery, misconceptions and student questions`
                  : '✦ Built from class mastery. Ask Curriculum AI to add teaching suggestions.'}
            </div>
          </div>
        </div>

        {/* Trend + insights */}
        <div className="card" style={{ padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>Weekly comprehension trend (L12)</div>
              <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>{COURSE} · Weeks 1–{CURRENT_WEEK - 1} are demo history; Week {CURRENT_WEEK} is live</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'24px', alignItems:'start' }}>
            <div style={{ position:'relative', height:'200px' }}>
              <canvas ref={chartRef} role="img" aria-label={`Comprehension trend by week, currently ${classAvg}%`}/>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ padding:'12px', background:'#FEF3C7', borderRadius:'10px', border:'1px solid #FDE68A' }}>
                <div style={{ fontSize:'10px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>Curriculum AI insight</div>
                <p style={{ fontSize:'12px', color:'#78350F', lineHeight:1.5, margin:0 }}>
                  Students with 10+ Curriculum AI sessions average {average(frequent.map(s => s.score))}% mastery, against {average(occasional.map(s => s.score))}% for those with fewer ({frequent.length} vs {occasional.length} students).
                </p>
              </div>
              <div style={{ padding:'12px', background:'#F8FAFC', borderRadius:'10px', border:'1px solid #E2E8F0' }}>
                <div style={{ fontSize:'10px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'6px' }}>Misconceptions Curriculum AI noticed</div>
                {misconceptions.length === 0 && <p style={{ fontSize:'12px', color:'#94A3B8', margin:0 }}>None this week.</p>}
                {misconceptions.slice(0, 5).map((m, i) => (
                  <div key={i} style={{ fontSize:'12px', color:'#334155', lineHeight:1.45, padding:'5px 0', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none' }}>
                    <strong style={{ fontWeight:600 }}>{m.topic}:</strong> {m.note}
                    <span style={{ display:'block', fontSize:'10px', color:'#94A3B8' }}>{typeof m.at === 'number' ? timeAgo(m.at) : m.at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
