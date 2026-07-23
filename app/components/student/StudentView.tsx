'use client'
import { useState } from 'react'
import StudentSidebar from './StudentSidebar'
import StudentChat from './StudentChat'
import StudentProgress from './StudentProgress'
import { COURSES } from './studentData'

export default function StudentView() {
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0])
  const [showProgress, setShowProgress] = useState(true)

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', height:'100%' }}>
      <StudentSidebar
        selectedCourse={selectedCourse}
        setSelectedCourse={setSelectedCourse}
      />
      <StudentChat
        selectedCourse={selectedCourse}
        showProgress={showProgress}
        setShowProgress={setShowProgress}
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
