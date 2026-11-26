'use client'
import { useEffect, useState } from 'react'
import StudentSidebar from './StudentSidebar'
import StudentChat from './StudentChat'
import StudentProgress from './StudentProgress'
import Assessment from './Assessment'
import { useStore, type Course } from '../../lib/demoStore'

export default function StudentView({ initialCourse }: { initialCourse?: string }) {
  const { state, refresh } = useStore()
  const [selectedCode, setSelectedCode] = useState<string | null>(initialCourse ?? null)
  const [showProgress, setShowProgress] = useState(true)
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
    setPendingPrompt({ course: course.code, text: `I'd like to work on ${topic}. Check what I already know, then give me a practice set.` })
  }

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', height:'100%', zoom: state.profile?.accessibility.largerText ? 1.15 : undefined }}>
      <StudentSidebar
        selectedCourse={selectedCourse}
        setSelectedCourse={setSelectedCourse}
        onStartSession={startSession}
      />
      <StudentChat
        key={selectedCourse.code}
        selectedCourse={selectedCourse}
        showProgress={showProgress}
        setShowProgress={setShowProgress}
        pendingPrompt={pendingPrompt?.course === selectedCourse.code ? pendingPrompt.text : null}
        clearPendingPrompt={() => setPendingPrompt(null)}
      />
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
