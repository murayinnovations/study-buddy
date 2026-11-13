import { NextRequest } from 'next/server'
import { z } from 'zod/v4'
import { supabaseAuth } from '../../../lib/auth'
import { rateLimited, tooMany } from '../../../lib/rateLimit'

// Signs in with email and password. Someone new joins as a student the first
// time they open the app (see getOrCreateMember in lib/db.ts).

const Body = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) })

export async function POST(req: NextRequest) {
  if (rateLimited(req, 'login')) return tooMany()

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return Response.json({ error: 'Enter your email and password.' }, { status: 400 })
  }

  try {
    const { error } = await supabaseAuth().auth.signInWithPassword({ email: body.email.toLowerCase(), password: body.password })
    if (error) {
      if (error.code === 'email_not_confirmed') {
        return Response.json({ error: 'Confirm your email first: open the link we sent when you created your account.' }, { status: 403 })
      }
      if (error.code === 'invalid_credentials') {
        return Response.json({ error: 'Wrong email or password.' }, { status: 401 })
      }
      console.error('Sign-in failed:', error.message)
      return Response.json({ error: 'Could not sign in. Please try again.' }, { status: 502 })
    }
  } catch (err) {
    console.error('Sign-in failed:', err)
    return Response.json({ error: 'Could not sign in. Please try again.' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
