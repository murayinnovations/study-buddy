// The branded card shared by the sign-in and reset-password pages.
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px',
      background:'radial-gradient(ellipse at top, #0D1B3D 0%, #070F24 70%)',
    }}>
      <div style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px', justifyContent:'center' }}>
          <div style={{
            width:'40px', height:'40px', borderRadius:'11px',
            background:'#E8D44D',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 3C8 3 5 6 5 10c0 2.5 1.2 4.7 3 6.1V18h8v-1.9c1.8-1.4 3-3.6 3-6.1 0-4-3-7-7-7z" fill="#0D1B3D"/>
              <rect x="9" y="18" width="6" height="2" rx="1" fill="#0D1B3D" opacity=".8"/>
              <rect x="10" y="20" width="4" height="1.5" rx=".75" fill="#0D1B3D" opacity=".6"/>
            </svg>
          </div>
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
