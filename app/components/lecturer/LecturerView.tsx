'use client'
import { useState } from 'react'
import LecturerOverview from './LecturerOverview'
import LecturerStudents from './LecturerStudents'
import LecturerContent from './LecturerContent'
import LecturerQuestions from './LecturerQuestions'
import { useStore } from '../../lib/demoStore'

const TABS = [
  { id:'overview',   label:'Class overview',    icon:'📊' },
  { id:'students',   label:'Individual students',icon:'👥' },
  { id:'content',    label:'Content & approval', icon:'✓' },
  { id:'questions',  label:'Student questions',  icon:'💬' },
]

export default function LecturerView() {
  const [tab, setTab] = useState('overview')
  const { state } = useStore()
  const unanswered = state.questions.filter(q => q.course === 'SBS 201' && !q.reply).length

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {/* Tab bar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'0 24px', display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding:'13px 16px', border:'none', background:'none', cursor:'pointer',
              fontSize:'13px', fontWeight:500, fontFamily:'inherit',
              color: tab===t.id ? '#2563EB' : '#64748B',
              borderBottom: tab===t.id ? '2px solid #2563EB' : '2px solid transparent',
              marginBottom:'-1px', display:'flex', alignItems:'center', gap:'6px',
              transition:'color .15s',
            }}
          >
            <span style={{ fontSize:'14px' }}>{t.icon}</span>
            {t.label}
            {t.id === 'questions' && unanswered > 0 && (
              <span className="badge badge-red" style={{ fontSize:'10px', padding:'1px 7px' }}>{unanswered}</span>
            )}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#94A3B8' }}>
          <span className="ai-pulse" style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#059669', display:'inline-block' }}/>
          Financial Accounting SBS 201 · Week 9 of 14
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflow:'hidden' }}>
        {tab==='overview'  && <LecturerOverview />}
        {tab==='students'  && <LecturerStudents />}
        {tab==='content'   && <LecturerContent />}
        {tab==='questions' && <LecturerQuestions />}
      </div>
    </div>
  )
}
