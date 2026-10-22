import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getMember } from './db'
import type { Member, Role } from './demoData'

// Sign-in sessions. Supabase Auth keeps the session in cookies; who someone is
// in Arthur (role, name, student number) comes from the members table.

export function supabaseAuth() {
  const store = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        // Server components can't set cookies; the middleware refreshes the session for pages.
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)) } catch {}
      },
    },
  })
}

// The signed-in email, verified from the session token.
export async function signedInEmail(): Promise<string | null> {
  const { data } = await supabaseAuth().auth.getClaims()
  const email = data?.claims.email
  return typeof email === 'string' ? email : null
}

export async function currentMember(): Promise<Member | null> {
  const email = await signedInEmail()
  return email ? getMember(email) : null
}

// For API routes: the member, or an error response to return instead.
export async function requireMember(...roles: Role[]): Promise<Member | Response> {
  const member = await currentMember()
  if (!member) return Response.json({ error: 'Please sign in again.' }, { status: 401 })
  if (roles.length > 0 && !roles.includes(member.role)) return Response.json({ error: 'Not allowed.' }, { status: 403 })
  return member
}
