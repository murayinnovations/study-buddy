import { redirect } from 'next/navigation'
import { currentMember, realMember } from './lib/auth'
import App from './components/shared/App'

export const dynamic = 'force-dynamic'

// ?course=<code> opens that course, e.g. after a launch from the learning platform (app/lti).
export default async function Home({ searchParams }: { searchParams: { course?: string } }) {
  const [real, member] = await Promise.all([realMember(), currentMember()])
  if (!real || !member) redirect('/login')
  return <App member={member} isAdmin={real.role === 'admin'} initialCourse={searchParams.course} />
}
