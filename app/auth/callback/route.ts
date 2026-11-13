import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseAuth } from '../../lib/auth'

// Where emailed links land: confirming a new account, and resetting a password.
// Supabase's default emails send a one-time code that only works in the browser
// that asked for it; email templates that link here with token_hash work from
// any device (see README).

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const auth = supabaseAuth().auth

  let ok = false
  if (code) ok = !(await auth.exchangeCodeForSession(code)).error
  else if (tokenHash && type) ok = !(await auth.verifyOtp({ token_hash: tokenHash, type })).error

  // Only one place to go besides home, so this can't be used as an open redirect.
  const reset = type === 'recovery' || params.get('next') === '/reset-password'
  return NextResponse.redirect(new URL(!ok ? '/login?error=link' : reset ? '/reset-password' : '/', req.url))
}
