'use client'
import { useState } from 'react'
import StudentSidebar from './StudentSidebar'
import StudentChat from './StudentChat'
import StudentProgress from './StudentProgress'
import { COURSES, type Course } from './studentData'

export default function StudentView() {
  const [selectedCourse, setSelectedCourse] = useState<Course>(COURSES[0])
  const [showProgress, setShowProgress] = useState(true)
  // A message to send as soon as the chat for this course is showing.
  const [pendingPrompt, setPendingPrompt] = useState<{ course: string; text: string } | null>(null)

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
