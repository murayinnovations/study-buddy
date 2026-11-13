import { NextRequest } from 'next/server'
import { z } from 'zod/v4'
import { supabaseAuth } from '../../../lib/auth'
import { rateLimited, tooMany } from '../../../lib/rateLimit'
import { MIN_PASSWORD } from '../../../lib/password'

// Creates an account. If "Confirm email" is on in Supabase, no session comes
// back and the person has to open the emailed link first; otherwise they're
// signed in straight away.

const Body = z.object({ email: z.email().max(254), password: z.string().min(MIN_PASSWORD).max(200) })

export async function POST(req: NextRequest) {
  if (rateLimited(req, 'signup')) return tooMany()

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch {
    return Response.json({ error: `Enter a valid email and a password of at least ${MIN_PASSWORD} characters.` }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAuth().auth.signUp({
      email: body.email.toLowerCase(),
      password: body.password,
      options: { emailRedirectTo: `${req.nextUrl.origin}/auth/callback` },
    })
    if (error) {
      if (error.code === 'user_already_exists') {
        return Response.json({ error: 'That email already has an account. Sign in instead, or reset your password.' }, { status: 409 })
      }
      if (error.code === 'weak_password') {
        return Response.json({ error: 'That password is too weak. Try a longer one.' }, { status: 400 })
      }
      console.error('Sign-up failed:', error.message)
      const wait = error.status === 429
      return Response.json(
        { error: wait ? 'Too many sign-ups just now. Please wait a minute and try again.' : 'Could not create the account. Please try again.' },
        { status: wait ? 429 : 502 })
    }
    // With email confirmation on, an existing email also lands here (with no session),
    // so the reply doesn't reveal whether the address already has an account.
    return Response.json({ ok: true, signedIn: Boolean(data.session) })
  } catch (err) {
    console.error('Sign-up failed:', err)
    return Response.json({ error: 'Could not create the account. Please try again.' }, { status: 502 })
  }
}
