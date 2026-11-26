// The branded card shared by the sign-in and reset-password pages.
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
      background:'radial-gradient(ellipse at top, #0D1B3D 0%, #070F24 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px', justifyContent:'center' }}>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:'20px', lineHeight:1 }}>Study Buddy</div>
            <div style={{ color:'rgba(255,255,255,.5)', fontSize:'11px', marginTop:'3px' }}>Strathmore pilot · by Muray Innovations</div>
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:'16px', padding:'28px', boxShadow:'0 20px 50px rgba(0,0,0,.35)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
