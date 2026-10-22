import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseAuth } from '../../lib/auth'

// Where the emailed link lands. Supabase's default email sends a one-time code
// that only works in the browser that asked for the link; an email template that
// links here with token_hash works from any device (see README).

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const auth = supabaseAuth().auth

  let ok = false
  if (code) ok = !(await auth.exchangeCodeForSession(code)).error
  else if (tokenHash && type) ok = !(await auth.verifyOtp({ token_hash: tokenHash, type })).error

  return NextResponse.redirect(new URL(ok ? '/' : '/login?error=link', req.url))
}
