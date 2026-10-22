import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAuth } from '../../lib/auth'

export async function POST(req: NextRequest) {
  await supabaseAuth().auth.signOut()
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 })
}
