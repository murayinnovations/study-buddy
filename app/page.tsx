import { redirect } from 'next/navigation'
import { signedInEmail } from './lib/auth'
import { getMember } from './lib/db'
import App from './components/shared/App'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const email = await signedInEmail()
  if (!email) redirect('/login')
  const member = await getMember(email)
  if (!member) return <NoAccess email={email} />
  return <App member={member} />
}

// Signed in, but not on the members list (or since removed from it).
function NoAccess({ email }: { email: string }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', background:'#F8FAFC' }}>
      <div style={{ maxWidth:'400px', background:'#fff', border:'1px solid #E2E8F0', borderRadius:'14px', padding:'28px' }}>
        <h1 style={{ fontSize:'17px', fontWeight:700, color:'#0F172A', margin:0 }}>No access yet</h1>
        <p style={{ fontSize:'13px', color:'#64748B', lineHeight:1.6, margin:'8px 0 18px' }}>
          {email} isn&apos;t on the Arthur pilot list. Ask the Arthur team to add you, then sign in again.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn-primary" style={{ padding:'9px 16px' }}>Sign out</button>
        </form>
      </div>
    </div>
  )
}
