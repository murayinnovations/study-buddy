'use client'
import { useState } from 'react'
import AppShell from './components/shared/AppShell'
import StudentView from './components/student/StudentView'
import LecturerView from './components/lecturer/LecturerView'
import HoDView from './components/hod/HoDView'

export type Role = 'student' | 'lecturer' | 'hod'

export default function Home() {
  const [role, setRole] = useState<Role>('student')
  return (
    <AppShell role={role} setRole={setRole}>
      {role === 'student'  && <StudentView />}
      {role === 'lecturer' && <LecturerView />}
      {role === 'hod'      && <HoDView />}
    </AppShell>
  )
}
