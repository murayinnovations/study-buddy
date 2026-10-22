import { NextRequest } from 'next/server'
import { z } from 'zod/v4'
import { supabaseAuth } from '../../../lib/auth'
import { getMember } from '../../../lib/db'

// Emails a sign-in link to people on the members list. Everyone gets the same
// reply, so the form can't be used to find out who has access.

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60_000
const hits = new Map<string, number[]>()

function rateLimited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE_LIMIT
}

const Body = z.object({ email: z.email().max(254) })

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return Response.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })

  let email: string
  try {
    email = Body.parse(await req.json()).email.toLowerCase()
  } catch {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  try {
    if (await getMember(email)) {
      const { error } = await supabaseAuth().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${req.nextUrl.origin}/auth/callback`, shouldCreateUser: true },
      })
      if (error) {
        console.error('Sending sign-in link failed:', error.message)
        const wait = error.status === 429
        return Response.json(
          { error: wait ? 'A link was sent very recently. Please wait a minute and try again.' : 'Could not send the link. Please try again.' },
          { status: wait ? 429 : 502 })
      }
    }
  } catch (err) {
    console.error('Sign-in failed:', err)
    return Response.json({ error: 'Could not send the link. Please try again.' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
