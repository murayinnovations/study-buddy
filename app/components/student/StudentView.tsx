'use client'
import { useState } from 'react'
import StudentSidebar from './StudentSidebar'
import StudentChat from './StudentChat'
import StudentProgress from './StudentProgress'
import { useStore, type Course } from '../../lib/demoStore'

export default function StudentView({ initialCourse }: { initialCourse?: string }) {
  const { state } = useStore()
  const [selectedCode, setSelectedCode] = useState<string | null>(initialCourse ?? null)
  const [showProgress, setShowProgress] = useState(true)
  // A message to send as soon as the chat for this course is showing.
  const [pendingPrompt, setPendingPrompt] = useState<{ course: string; text: string } | null>(null)

  const selectedCourse = state.courses.find(c => c.code === selectedCode) ?? state.courses[0]
  if (!selectedCourse) {
    return <div style={{ margin:'auto', fontSize:'13px', color:'#94A3B8' }}>No courses are open on Curriculum AI yet.</div>
  }

  const setSelectedCourse = (c: Course) => setSelectedCode(c.code)
  const startSession = (course: Course, topic: string) => {
    setSelectedCourse(course)
    setPendingPrompt({ course: course.code, text: `I'd like to work on ${topic}. Can you start by checking what I already know?` })
  }

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', height:'100%' }}>
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
        />
      )}
    </div>
  )
}
