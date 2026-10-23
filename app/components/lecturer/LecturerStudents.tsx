'use client'
import { useMemo, useState } from 'react'
import { useStore } from '../../lib/demoStore'
import { buildCohort, SYNTHETIC_COUNT, TAUGHT_TOPICS, type CohortStudent, type Status } from '../../lib/cohort'
import { daysAgoLabel, masteryColor } from '../../lib/format'

const COURSE = 'SBS 201'

const statusCfg: Record<Status,{badge:string;color:string;bg:string}> = {
  'Critical':  { badge:'badge-red',    color:'#DC2626', bg:'#FEF2F2' },
  'At risk':   { badge:'badge-amber',  color:'#D97706', bg:'#FFFBEB' },
  'On track':  { badge:'badge-green',  color:'#059669', bg:'#F0FDF4' },
  'Excelling': { badge:'badge-blue',   color:'#2563EB', bg:'#EFF6FF' },
}

const ORDER: Status[] = ['Critical', 'At risk', 'On track', 'Excelling']

export default function LecturerStudents() {
  const { state, sendCheckIn } = useStore()
  const cohort = useMemo(() => buildCohort(state.students), [state.students])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Status>('all')

  const sorted = [...cohort].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.score - b.score)
  const filtered = filter === 'all' ? sorted : sorted.filter(s => s.status === filter)
  const selected: CohortStudent | undefined = cohort.find(s => s.id === selectedId)

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Table */}
      <div style={{ flex:1, overflow:'auto', padding:'20px 24px', background:'#F8FAFC' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto' }}>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', gap:'12px', flexWrap:'wrap' }}>
            <div>
              <h2 style={{ fontSize:'15px', fontWeight:700, color:'#0F172A', margin:0 }}>Individual student view (L4 · L7)</h2>
              <p style={{ fontSize:'12px', color:'#94A3B8', margin:'3px 0 0' }}>Identities anonymised · Click a row for detail</p>
            </div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {(['all', ...ORDER] as const).map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{ padding:'6px 12px', borderRadius:'7px', border:'1.5px solid', fontSize:'12px', fontWeight:500, fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
                    borderColor: filter===f ? '#2563EB' : '#E2E8F0',
                    background: filter===f ? '#EFF6FF' : '#fff',
                    color: filter===f ? '#2563EB' : '#475569',
                  }}
                >
                  {f==='all' ? 'All' : f} ({f==='all' ? cohort.length : cohort.filter(s => s.status === f).length})
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F8FAFC' }}>
                  {['Student ID','Last active','Engagement','Weakest topic','Sessions','Score','Status'].map(h=>(
                    <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.6px', borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s=>{
                  const cfg = statusCfg[s.status]
                  const isSel = selectedId === s.id
                  const engColor = s.engagement<30?'#DC2626':s.engagement<50?'#D97706':'#059669'
                  return (
                    <tr key={s.id}
                      onClick={()=>setSelectedId(isSel ? null : s.id)}
                      style={{ cursor:'pointer', background: isSel?'#EFF6FF':'transparent', borderBottom:'1px solid #F8FAFC', transition:'background .15s' }}
                      onMouseEnter={e=>{ if(!isSel)(e.currentTarget as HTMLElement).style.background='#F8FAFC' }}
                      onMouseLeave={e=>{ if(!isSel)(e.currentTarget as HTMLElement).style.background='transparent' }}
                    >
                      <td style={{ padding:'12px 14px', fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#64748B', whiteSpace:'nowrap' }}>
                        {s.id}
                        {s.live && <span className="badge badge-blue" style={{ marginLeft:'6px', fontFamily:'Inter', fontSize:'9px' }}>● Live</span>}
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:'12px', color:'#475569' }}>{daysAgoLabel(s.daysAgo)}</td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'70px', height:'4px', background:'#F1F5F9', borderRadius:'2px' }}>
                            <div style={{ height:'4px', width:`${s.engagement}%`, background:engColor, borderRadius:'2px' }}/>
                          </div>
                          <span style={{ fontSize:'11px', fontWeight:600, color:engColor }}>{s.engagement}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:'12px', color:'#475569' }}>{s.weakTopic}</td>
                      <td style={{ padding:'12px 14px', fontSize:'12px', color:'#475569', textAlign:'center' }}>{s.sessions}</td>
                      <td style={{ padding:'12px 14px', fontSize:'13px', fontWeight:600, color:'#0F172A' }}>
                        {s.score}% <span style={{ fontSize:'11px', color: s.trend==='↑'?'#059669':s.trend==='↓'?'#DC2626':'#94A3B8' }}>{s.trend}</span>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span className={`badge ${cfg.badge}`}>{s.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize:'11px', color:'#94A3B8', marginTop:'10px' }}>
            Showing {filtered.length} of {cohort.length} students · ● Live marks signed-up students; the other {SYNTHETIC_COUNT} are synthetic
          </p>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ width:'300px', flexShrink:0, background:'#fff', borderLeft:'1px solid #E2E8F0', overflow:'auto' }} className="slide-in">
          <div style={{ padding:'16px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A' }}>Student detail</div>
            <button onClick={()=>setSelectedId(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'18px' }}>×</button>
          </div>
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ padding:'14px', background: statusCfg[selected.status].bg, borderRadius:'10px' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#94A3B8', marginBottom:'4px' }}>{selected.id}</div>
              <div style={{ fontSize:'20px', fontWeight:700, color: statusCfg[selected.status].color }}>{selected.score}%</div>
              <div style={{ fontSize:'12px', color:'#64748B' }}>Mastery across topics taught · {selected.trend} trend</div>
              <span className={`badge ${statusCfg[selected.status].badge}`} style={{ marginTop:'8px', display:'inline-flex' }}>{selected.status}</span>
            </div>

            {[...TAUGHT_TOPICS].sort((a, b) => selected.scores[a] - selected.scores[b]).map(t => {
              const score = selected.scores[t]
              const color = masteryColor(score)
              return (
                <div key={t}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                    <span style={{ color:'#475569' }}>{t}</span>
                    <span style={{ fontWeight:600, color }}>{score}%</span>
                  </div>
                  <div style={{ height:'4px', background:'#F1F5F9', borderRadius:'2px' }}>
                    <div style={{ height:'4px', width:`${score}%`, background:color, borderRadius:'2px', transition:'width .5s' }}/>
                  </div>
                </div>
              )
            })}

            <div style={{ padding:'12px', background:'#FFFBEB', borderRadius:'9px', border:'1px solid #FDE68A' }}>
              <div style={{ fontSize:'10px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'5px' }}>Curriculum AI recommendation (L7)</div>
              <p style={{ fontSize:'12px', color:'#78350F', lineHeight:1.5, margin:0 }}>
                {selected.status === 'Critical' || selected.status === 'At risk'
                  ? `Last active ${daysAgoLabel(selected.daysAgo).toLowerCase()}, engagement at ${selected.engagement}%. Suggest a direct check-in before the next tutorial, focused on ${selected.weakTopic}.`
                  : `Doing well overall. ${selected.weakTopic} (${selected.scores[selected.weakTopic]}%) is the topic to push next.`}
              </p>
            </div>

            {state.checkIns.includes(selected.id) ? (
              <div style={{ padding:'10px', textAlign:'center', fontSize:'12px', color:'#059669', fontWeight:600, background:'#ECFDF5', borderRadius:'8px' }}>
                ✓ Check-in sent
              </div>
            ) : (
              <button onClick={() => sendCheckIn(selected.id)} className="btn-primary" style={{ width:'100%', padding:'10px' }}>
                Send check-in message (L8)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
