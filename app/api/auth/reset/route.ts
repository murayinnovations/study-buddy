import { NextRequest } from 'next/server'
import { z } from 'zod/v4'
import { supabaseAuth } from '../../../lib/auth'
import { rateLimited, tooMany } from '../../../lib/rateLimit'

// Emails a link to choose a new password. Everyone gets the same reply, so the
// form can't be used to find out which emails have accounts.

const Body = z.object({ email: z.email().max(254) })

export async function POST(req: NextRequest) {
  if (rateLimited(req, 'reset')) return tooMany()

  let email: string
  try {
    email = Body.parse(await req.json()).email.toLowerCase()
  } catch {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const { error } = await supabaseAuth().auth.resetPasswordForEmail(email, {
    redirectTo: `${req.nextUrl.origin}/auth/callback?next=/reset-password`,
  })
  if (error) {
    console.error('Password reset email failed:', error.message)
    if (error.status === 429) return Response.json({ error: 'An email was sent very recently. Please wait a minute and try again.' }, { status: 429 })
  }
  return Response.json({ ok: true })
}
