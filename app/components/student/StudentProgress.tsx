'use client'
import type { Course } from './studentData'
import { useStore } from '../../lib/demoStore'
import { average, daysAgoLabel, masteryColor } from '../../lib/format'

function MasteryBar({ score }: { score: number }) {
  return (
    <div style={{ height:'5px', background:'#F1F5F9', borderRadius:'3px', overflow:'hidden', width:'100%' }}>
      <div style={{ height:'5px', width:`${score}%`, background:masteryColor(score), borderRadius:'3px', transition:'width .5s ease' }}/>
    </div>
  )
}

export default function StudentProgress({ selectedCourse, onClose }: { selectedCourse: Course; onClose: () => void }) {
  const { state } = useStore()
  const topics = state.mastery[selectedCourse.code] || []
  const sorted = [...topics].sort((a,b) => a.score - b.score)
  const weakTopics = sorted.filter(t => t.score < 60 && t.sessions > 0)
  const strongTopics = sorted.filter(t => t.score >= 75).reverse()
  const avgScore = average(topics.map(t => t.score))
  const practice = state.practiceLog.filter(p => p.course === selectedCourse.code)

  return (
    <aside style={{
      width:'300px', flexShrink:0, background:'#fff',
      borderLeft:'1px solid #E2E8F0', display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      <div style={{
        padding:'14px 16px', borderBottom:'1px solid #E2E8F0',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
      }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'13px', color:'#0F172A' }}>Your Progress</div>
          <div style={{ fontSize:'11px', color:'#94A3B8' }}>{selectedCourse.code} · {topics.length} topics</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'18px', lineHeight:1 }}>×</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* Overall score */}
        <div style={{ background:'linear-gradient(135deg,#EFF6FF,#F0F9FF)', borderRadius:'12px', padding:'16px', border:'1px solid #BFDBFE', textAlign:'center' }}>
          <div style={{ fontSize:'36px', fontWeight:800, color:'#1D4ED8', lineHeight:1 }}>{avgScore}%</div>
          <div style={{ fontSize:'12px', color:'#3B82F6', fontWeight:500, marginTop:'4px' }}>Overall mastery</div>
          <div style={{ fontSize:'11px', color:'#64748B', marginTop:'8px' }}>
            {avgScore >= 75 ? '✓ On track for the exam' : avgScore >= 50 ? '⚠ Some areas need work' : '↗ Focus on your weak topics'}
          </div>
          {practice.length > 0 && (
            <div style={{ fontSize:'11px', color:'#2563EB', marginTop:'6px', fontWeight:500 }}>
              {practice.length} practice question{practice.length === 1 ? '' : 's'} this session · {practice.filter(p => p.correct).length} correct
            </div>
          )}
        </div>

        {/* Curriculum AI gap alert (S11) */}
        {weakTopics.length > 0 && (
          <div style={{ background:'#FFFBEB', borderRadius:'10px', padding:'12px', border:'1px solid #FDE68A' }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:'#92400E', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'6px' }}>
              ⚡ Curriculum AI has spotted gaps
            </div>
            {weakTopics.slice(0,3).map(t => (
              <div key={t.topic} style={{ fontSize:'12px', color:'#78350F', marginBottom:'4px', display:'flex', justifyContent:'space-between' }}>
                <span>• {t.topic}</span>
                <span style={{ fontWeight:600 }}>{t.score}%</span>
              </div>
            ))}
            <div style={{ fontSize:'11px', color:'#92400E', marginTop:'6px', fontStyle:'italic' }}>
              Ask Curriculum AI for a practice question on any of these to move your score.
            </div>
          </div>
        )}

        {/* All topics */}
        <div>
          <div style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:'8px' }}>
            Topic mastery
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {topics.map(t => {
              const color = masteryColor(t.score)
              const label = t.sessions === 0 ? 'Not started' : t.score >= 75 ? 'Strong' : t.score >= 50 ? 'Learning' : 'Needs work'
              return (
                <div key={t.topic} style={{ background:'#F8FAFC', borderRadius:'8px', padding:'10px 12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                    <span style={{ fontSize:'12px', fontWeight:500, color:'#0F172A' }}>{t.topic}</span>
                    <span style={{ fontSize:'10px', fontWeight:600, color: t.sessions === 0 ? '#64748B' : color, background: t.sessions === 0 ? '#F1F5F9' : t.score>=75?'#ECFDF5':t.score>=50?'#FFFBEB':'#FEF2F2', padding:'2px 7px', borderRadius:'10px' }}>
                      {label}
                    </span>
                  </div>
                  <MasteryBar score={t.score}/>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'5px', fontSize:'10px', color:'#94A3B8' }}>
                    <span>{t.score}% mastered</span>
                    <span>{daysAgoLabel(t.daysAgo)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Study path (S12) */}
        <div>
          <div style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:'8px' }}>
            Your study path
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {sorted.slice(0,4).map((t,i) => (
              <div key={t.topic} style={{
                display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px',
                borderRadius:'8px', border:'1.5px solid', transition:'all .15s',
                borderColor: i===0 ? '#93C5FD' : '#E2E8F0',
                background: i===0 ? '#EFF6FF' : '#F8FAFC',
              }}>
                <div style={{
                  width:'20px', height:'20px', borderRadius:'50%', flexShrink:0,
                  background: i===0 ? '#2563EB' : '#E2E8F0',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: i===0 ? '#fff' : '#94A3B8', fontSize:'10px', fontWeight:700,
                }}>
                  {i+1}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'12px', fontWeight: i===0 ? 600 : 400, color: i===0 ? '#1D4ED8' : '#475569', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {t.topic}
                  </div>
                  <div style={{ fontSize:'10px', color:'#94A3B8' }}>{t.score}% · {t.sessions} session{t.sessions!==1?'s':''}</div>
                </div>
                {i===0 && <span style={{ fontSize:'10px', fontWeight:600, color:'#2563EB' }}>Next →</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Strong areas */}
        {strongTopics.length > 0 && (
          <div>
            <div style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:'8px' }}>
              Strong areas ✓
            </div>
            {strongTopics.slice(0,3).map(t => (
              <div key={t.topic} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', background:'#ECFDF5', borderRadius:'7px', marginBottom:'5px' }}>
                <span style={{ fontSize:'12px', color:'#065F46' }}>{t.topic}</span>
                <span style={{ fontSize:'11px', fontWeight:700, color:'#059669' }}>{t.score}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
