import { NextRequest } from 'next/server'
import { z } from 'zod/v4'
import { supabaseAuth } from '../../../lib/auth'
import { MIN_PASSWORD } from '../../../lib/password'

// Sets a new password for the signed-in person (after a reset link signs them in).

const Body = z.object({ password: z.string().min(MIN_PASSWORD).max(200) })

export async function POST(req: NextRequest) {
  let password: string
  try {
    password = Body.parse(await req.json()).password
  } catch {
    return Response.json({ error: `Use at least ${MIN_PASSWORD} characters.` }, { status: 400 })
  }

  const auth = supabaseAuth().auth
  const { data } = await auth.getClaims()
  if (!data?.claims) return Response.json({ error: 'That reset link has expired. Request a new one.' }, { status: 401 })

  const { error } = await auth.updateUser({ password })
  if (error) {
    if (error.code === 'same_password') return Response.json({ error: 'Choose a different password from your old one.' }, { status: 400 })
    if (error.code === 'weak_password') return Response.json({ error: 'That password is too weak. Try a longer one.' }, { status: 400 })
    console.error('Password update failed:', error.message)
    return Response.json({ error: 'Could not save the password. Please try again.' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
