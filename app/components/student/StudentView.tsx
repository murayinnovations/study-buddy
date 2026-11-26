'use client'
import { useEffect, useState } from 'react'
import StudentSidebar from './StudentSidebar'
import StudentChat from './StudentChat'
import StudentProgress from './StudentProgress'
import Assessment from './Assessment'
import StudentPractice from './StudentPractice'
import { useStore, type Course } from '../../lib/demoStore'

export default function StudentView({ initialCourse }: { initialCourse?: string }) {
  const { state, refresh } = useStore()
  const [selectedCode, setSelectedCode] = useState<string | null>(initialCourse ?? null)
  const [showProgress, setShowProgress] = useState(true)
  const [mode, setMode] = useState<'chat' | 'quiz' | 'cards'>('chat')
  // A message to send as soon as the chat for this course is showing.
  const [pendingPrompt, setPendingPrompt] = useState<{ course: string; text: string } | null>(null)

  // Every student takes the onboarding assessment before studying. Kept open until they
  // press "Start learning", so a background refresh that picks up the new profile
  // doesn't swap their profile card for the chat mid-read.
  const needsProfile = state.profileReady && !state.profile
  const [assessing, setAssessing] = useState<'required' | 'retake' | null>(null)
  useEffect(() => { if (needsProfile) setAssessing('required') }, [needsProfile])

  if (needsProfile || assessing) {
    return (
      <Assessment
        onDone={async () => { await refresh(); setAssessing(null) }}
        onCancel={assessing === 'retake' && !needsProfile ? () => setAssessing(null) : undefined}
      />
    )
  }

  const selectedCourse = state.courses.find(c => c.code === selectedCode) ?? state.courses[0]
  if (!selectedCourse) {
    return <div style={{ margin:'auto', fontSize:'13px', color:'#94A3B8' }}>No courses are open on Study Buddy yet.</div>
  }

  const setSelectedCourse = (c: Course) => setSelectedCode(c.code)
  const startSession = (course: Course, topic: string) => {
    setSelectedCourse(course)
    setMode('chat')
    setPendingPrompt({ course: course.code, text: `I'd like to work on ${topic}. Check what I already know, then give me a practice set.` })
  }

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', height:'100%', zoom: state.profile?.accessibility.largerText ? 1.15 : undefined }}>
      <StudentSidebar
        selectedCourse={selectedCourse}
        setSelectedCourse={setSelectedCourse}
        onStartSession={startSession}
      />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <div role="tablist" aria-label="Study mode" style={{ display:'flex', gap:'4px', padding:'8px 20px 0', background:'#fff', borderBottom:'1px solid #E2E8F0', flexShrink:0 }}>
          {([['chat', 'Chat'], ['quiz', 'Quiz'], ['cards', 'Flashcards']] as const).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={mode === key} onClick={() => setMode(key)} style={{
              padding:'8px 14px', fontSize:'13px', fontWeight: mode === key ? 600 : 500, fontFamily:'inherit', cursor:'pointer',
              background:'none', border:'none', borderBottom: `2px solid ${mode === key ? '#E8D44D' : 'transparent'}`,
              color: mode === key ? '#0D1B3D' : '#64748B', marginBottom:'-1px',
            }}>{label}</button>
          ))}
          {mode !== 'chat' && !showProgress && (
            <button onClick={() => setShowProgress(true)} style={{ marginLeft:'auto', marginBottom:'6px', fontSize:'12px', padding:'5px 10px', borderRadius:'8px', border:'1.5px solid #E2E8F0', background:'#fff', color:'#475569', cursor:'pointer', fontFamily:'inherit' }}>Show progress</button>
          )}
        </div>
        {mode === 'chat' ? (
        <StudentChat
          key={selectedCourse.code}
          selectedCourse={selectedCourse}
          showProgress={showProgress}
          setShowProgress={setShowProgress}
          pendingPrompt={pendingPrompt?.course === selectedCourse.code ? pendingPrompt.text : null}
          clearPendingPrompt={() => setPendingPrompt(null)}
        />
        ) : (
          <StudentPractice key={`${selectedCourse.code}-${mode}`} course={selectedCourse} kind={mode} />
        )}
      </div>
      {showProgress && (
        <StudentProgress
          selectedCourse={selectedCourse}
          onClose={() => setShowProgress(false)}
          onRetake={() => setAssessing('retake')}
        />
      )}
    </div>
  )
}
