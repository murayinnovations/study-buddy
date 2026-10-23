import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAuth, VIEW_AS_COOKIE } from '../../lib/auth'

export async function POST(req: NextRequest) {
  await supabaseAuth().auth.signOut()
  cookies().delete(VIEW_AS_COOKIE)
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 })
}
