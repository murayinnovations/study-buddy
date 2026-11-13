import { redirect } from 'next/navigation'
import { currentMember } from './lib/auth'
import App from './components/shared/App'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const member = await currentMember()
  if (!member) redirect('/login')
  return <App member={member} />
}
