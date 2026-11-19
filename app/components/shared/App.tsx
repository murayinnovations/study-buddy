'use client'
import AppShell from './AppShell'
import StudentView from '../student/StudentView'
import LecturerView from '../lecturer/LecturerView'
import HoDView from '../hod/HoDView'
import AdminView from '../admin/AdminView'
import { StoreProvider, useStore } from '../../lib/demoStore'
import type { Member } from '../../lib/demoData'

// isAdmin: the signed-in person is an admin, even while switched to another view.
export default function App({ member, isAdmin = false, initialCourse }: { member: Member; isAdmin?: boolean; initialCourse?: string }) {
  return (
    <StoreProvider member={member}>
      <AppShell isAdmin={isAdmin}>
        <RoleView initialCourse={initialCourse} />
      </AppShell>
    </StoreProvider>
  )
}

function RoleView({ initialCourse }: { initialCourse?: string }) {
  const { member, status } = useStore()
  if (status === 'loading' && member.role !== 'hod' && member.role !== 'admin') {
    return <div style={{ margin:'auto', fontSize:'13px', color:'#94A3B8' }}>Loading your Study Buddy…</div>
  }
  if (member.role === 'student') return <StudentView initialCourse={initialCourse} />
  if (member.role === 'lecturer') return <LecturerView />
  if (member.role === 'admin') return <AdminView />
  return <HoDView />
}
