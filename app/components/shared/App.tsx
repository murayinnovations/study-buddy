'use client'
import AppShell from './AppShell'
import StudentView from '../student/StudentView'
import LecturerView from '../lecturer/LecturerView'
import HoDView from '../hod/HoDView'
import { StoreProvider, useStore } from '../../lib/demoStore'
import type { Member } from '../../lib/demoData'

export default function App({ member }: { member: Member }) {
  return (
    <StoreProvider member={member}>
      <AppShell>
        <RoleView />
      </AppShell>
    </StoreProvider>
  )
}

function RoleView() {
  const { member, status } = useStore()
  if (status === 'loading' && member.role !== 'hod') {
    return <div style={{ margin:'auto', fontSize:'13px', color:'#94A3B8' }}>Loading your Arthur…</div>
  }
  if (member.role === 'student') return <StudentView />
  if (member.role === 'lecturer') return <LecturerView />
  return <HoDView />
}
