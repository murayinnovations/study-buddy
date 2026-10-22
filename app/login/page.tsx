import LoginForm from './LoginForm'

export const metadata = { title: 'Sign in · Arthur' }

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
      background:'radial-gradient(ellipse at top, #1E3A5F 0%, #0F1E33 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px', justifyContent:'center' }}>
          <div style={{
            width:'40px', height:'40px', borderRadius:'11px',
            background:'linear-gradient(135deg,#3B82F6,#2563EB)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 3C8 3 5 6 5 10c0 2.5 1.2 4.7 3 6.1V18h8v-1.9c1.8-1.4 3-3.6 3-6.1 0-4-3-7-7-7z" fill="white" opacity=".9"/>
              <rect x="9" y="18" width="6" height="2" rx="1" fill="white" opacity=".7"/>
              <rect x="10" y="20" width="4" height="1.5" rx=".75" fill="white" opacity=".5"/>
            </svg>
          </div>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:'20px', lineHeight:1 }}>Arthur</div>
            <div style={{ color:'rgba(255,255,255,.5)', fontSize:'11px', marginTop:'3px' }}>Strathmore University · Pilot</div>
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:'16px', padding:'28px', boxShadow:'0 20px 50px rgba(0,0,0,.35)' }}>
          <h1 style={{ fontSize:'18px', fontWeight:700, color:'#0F172A', margin:0 }}>Sign in</h1>
          <p style={{ fontSize:'13px', color:'#64748B', margin:'6px 0 20px', lineHeight:1.5 }}>
            Enter the email you were invited with and we&apos;ll send you a link to sign in. No password needed.
          </p>
          <LoginForm linkFailed={searchParams.error === 'link'} />
        </div>
      </div>
    </div>
  )
}
