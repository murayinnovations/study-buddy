'use client'
import { useState } from 'react'
import LecturerOverview from './LecturerOverview'
import LecturerStudents from './LecturerStudents'
import LecturerContent from './LecturerContent'
import LecturerQuestions from './LecturerQuestions'
import { useStore } from '../../lib/demoStore'

const TABS = [
  { id:'overview',   label:'Class overview' },
  { id:'students',   label:'Individual students' },
  { id:'content',    label:'Content & approval' },
  { id:'questions',  label:'Student questions' },
]

export default function LecturerView() {
  const [tab, setTab] = useState('overview')
  const { state } = useStore()
  const course = state.courses[0]
  if (!course) {
    return <div style={{ margin:'auto', fontSize:'13px', color:'#94A3B8' }}>No course is set up for you yet. Ask the Study Buddy team to assign one.</div>
  }
  const unanswered = state.questions.filter(q => q.course === course.code && !q.reply).length

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
              color: tab===t.id ? '#0D1B3D' : '#64748B',
              borderBottom: tab===t.id ? '2px solid #0D1B3D' : '2px solid transparent',
              marginBottom:'-1px', display:'flex', alignItems:'center', gap:'6px',
              transition:'color .15s',
            }}
          >
            {t.label}
            {t.id === 'questions' && unanswered > 0 && (
              <span className="badge badge-red" style={{ fontSize:'10px', padding:'1px 7px' }}>{unanswered}</span>
            )}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#94A3B8' }}>
          <span className="ai-pulse" style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#059669', display:'inline-block' }}/>
          {course.name} · {course.code}{course.currentWeek ? ` · Week ${course.currentWeek}${course.totalWeeks ? ` of ${course.totalWeeks}` : ''}` : ''}
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
