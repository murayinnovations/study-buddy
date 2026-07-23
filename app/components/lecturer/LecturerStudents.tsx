'use client'
import { useState } from 'react'

const STUDENTS = [
  { id:'STR-2023-0412', name:'Student A', lastActive:'6 days ago', engagement:18, weakTopic:'Depreciation', status:'Critical', sessions:3, score:31, trend:'↓' },
  { id:'STR-2023-0887', name:'Student B', lastActive:'4 days ago', engagement:24, weakTopic:'Accruals', status:'Critical', sessions:4, score:38, trend:'↓' },
  { id:'STR-2023-1104', name:'Student C', lastActive:'3 days ago', engagement:32, weakTopic:'Trial balance', status:'At risk', sessions:5, score:44, trend:'→' },
  { id:'STR-2023-0234', name:'Student D', lastActive:'2 days ago', engagement:37, weakTopic:'Cash flow', status:'At risk', sessions:6, score:48, trend:'→' },
  { id:'STR-2023-0558', name:'Student E', lastActive:'Yesterday',  engagement:39, weakTopic:'Double-entry', status:'At risk', sessions:7, score:51, trend:'↑' },
  { id:'STR-2023-0312', name:'Student F', lastActive:'Today',      engagement:72, weakTopic:'Depreciation', status:'On track', sessions:12, score:68, trend:'↑' },
  { id:'STR-2023-0890', name:'Student G', lastActive:'Today',      engagement:85, weakTopic:'Cash flow', status:'On track', sessions:15, score:74, trend:'↑' },
  { id:'STR-2023-1200', name:'Student H', lastActive:'Yesterday',  engagement:91, weakTopic:'—', status:'Excelling', sessions:18, score:88, trend:'↑' },
]

const statusCfg: Record<string,{badge:string;color:string;bg:string}> = {
  'Critical':  { badge:'badge-red',    color:'#DC2626', bg:'#FEF2F2' },
  'At risk':   { badge:'badge-amber',  color:'#D97706', bg:'#FFFBEB' },
  'On track':  { badge:'badge-green',  color:'#059669', bg:'#F0FDF4' },
  'Excelling': { badge:'badge-blue',   color:'#2563EB', bg:'#EFF6FF' },
}

export default function LecturerStudents() {
  const [selected, setSelected] = useState<typeof STUDENTS[0]|null>(null)
  const [filter, setFilter] = useState('all')

  const filtered = filter==='all' ? STUDENTS : STUDENTS.filter(s=>s.status.toLowerCase().replace(' ','')===filter)

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Table */}
      <div style={{ flex:1, overflow:'auto', padding:'20px 24px', background:'#F8FAFC' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto' }}>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <div>
              <h2 style={{ fontSize:'15px', fontWeight:700, color:'#0F172A', margin:0 }}>Individual student view (L4 · L7)</h2>
              <p style={{ fontSize:'12px', color:'#94A3B8', margin:'3px 0 0' }}>All identities anonymised · Click a row for detail</p>
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              {['all','critical','atrisk','ontrack','excelling'].map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{ padding:'6px 12px', borderRadius:'7px', border:'1.5px solid', fontSize:'12px', fontWeight:500, fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
                    borderColor: filter===f ? '#2563EB' : '#E2E8F0',
                    background: filter===f ? '#EFF6FF' : '#fff',
                    color: filter===f ? '#2563EB' : '#475569',
                  }}
                >
                  {f==='all'?'All':f==='atrisk'?'At risk':f.charAt(0).toUpperCase()+f.slice(1)}
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
                {filtered.map((s,i)=>{
                  const cfg = statusCfg[s.status]
                  return (
                    <tr key={s.id}
                      onClick={()=>setSelected(selected?.id===s.id?null:s)}
                      style={{ cursor:'pointer', background: selected?.id===s.id?'#EFF6FF':'transparent', borderBottom:'1px solid #F8FAFC', transition:'background .15s' }}
                      onMouseEnter={e=>{ if(selected?.id!==s.id)(e.currentTarget as HTMLElement).style.background='#F8FAFC' }}
                      onMouseLeave={e=>{ if(selected?.id!==s.id)(e.currentTarget as HTMLElement).style.background='transparent' }}
                    >
                      <td style={{ padding:'12px 14px', fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#64748B' }}>{s.id}</td>
                      <td style={{ padding:'12px 14px', fontSize:'12px', color:'#475569' }}>{s.lastActive}</td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'70px', height:'4px', background:'#F1F5F9', borderRadius:'2px' }}>
                            <div style={{ height:'4px', width:`${s.engagement}%`, background: s.engagement<30?'#DC2626':s.engagement<50?'#D97706':'#059669', borderRadius:'2px' }}/>
                          </div>
                          <span style={{ fontSize:'11px', fontWeight:600, color: s.engagement<30?'#DC2626':s.engagement<50?'#D97706':'#059669' }}>{s.engagement}%</span>
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
            Showing {filtered.length} of {STUDENTS.length} students · All data anonymised in compliance with Strathmore data policy
          </p>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ width:'300px', flexShrink:0, background:'#fff', borderLeft:'1px solid #E2E8F0', overflow:'auto' }} className="slide-in">
          <div style={{ padding:'16px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A' }}>Student detail</div>
            <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'18px' }}>×</button>
          </div>
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ padding:'14px', background: statusCfg[selected.status].bg, borderRadius:'10px' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'11px', color:'#94A3B8', marginBottom:'4px' }}>{selected.id}</div>
              <div style={{ fontSize:'20px', fontWeight:700, color: statusCfg[selected.status].color }}>{selected.score}%</div>
              <div style={{ fontSize:'12px', color:'#64748B' }}>Overall mastery · {selected.trend} trend</div>
              <span className={`badge ${statusCfg[selected.status].badge}`} style={{ marginTop:'8px', display:'inline-flex' }}>{selected.status}</span>
            </div>

            {['Depreciation','Accruals & prepayments','Trial balance','Income statement','Double-entry'].map((t,i)=>{
              const score = Math.max(10, selected.score - (i*8) + (i%2===0?5:-5))
              const color = score>=70?'#059669':score>=45?'#D97706':'#DC2626'
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
              <div style={{ fontSize:'10px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'5px' }}>Arthur recommendation (L7)</div>
              <p style={{ fontSize:'12px', color:'#78350F', lineHeight:1.5, margin:0 }}>
                Last active {selected.lastActive}. Engagement at {selected.engagement}%. Suggest a direct check-in before next tutorial. Focus on {selected.weakTopic}.
              </p>
            </div>

            <button className="btn-primary" style={{ width:'100%', padding:'10px' }}>
              Send check-in message (L8)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
