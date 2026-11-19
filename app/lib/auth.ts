import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { db, getOrCreateMember, getMemberByGroup } from './db'
import type { Member, Role } from './demoData'

// The one-button view switcher: members sharing a demo_group can swap into
// each other's account. The cookie only ever holds a role; which member that
// resolves to is looked up fresh from the real signed-in member's group, so
// it can't be used to reach an account outside that group.
export const VIEW_AS_COOKIE = 'view_as'
export const ROLES: Role[] = ['student', 'lecturer', 'hod']

// Sign-in sessions. Supabase Auth keeps the session in cookies; who someone is
// in Study Buddy (role, name, student number) comes from the members table,
// which gets a student row the first time someone new signs in.

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

// Signs someone in without an emailed link, for launches a learning platform has
// already vouched for (app/lti). Creates the same session the emailed link does:
// a one-time sign-in token is made server-side and used straight away.
export async function signInAs(email: string) {
  const admin = db().auth.admin
  const created = await admin.createUser({ email, email_confirm: true })
  if (created.error && created.error.code !== 'email_exists') throw new Error(created.error.message)
  const link = await admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw new Error(link.error.message)
  // Anyone can sign up with any address. If this account's email was never confirmed,
  // its password was set by someone who never proved they own the address, and
  // signing in here confirms it, so replace that password first.
  if (!link.data.user.email_confirmed_at) {
    const reset = await admin.updateUserById(link.data.user.id, { password: crypto.randomUUID() + crypto.randomUUID() })
    if (reset.error) throw new Error(reset.error.message)
  }
  const { error } = await supabaseAuth().auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' })
  if (error) throw new Error(error.message)
}

// The signed-in email, verified from the session token.
export async function signedInEmail(): Promise<string | null> {
  const { data } = await supabaseAuth().auth.getClaims()
  const email = data?.claims.email
  return typeof email === 'string' ? email : null
}

// The real signed-in member, ignoring any view-as switch. Anyone signed in is a
// member: first-time sign-ins join as students (see getOrCreateMember).
export async function realMember(): Promise<Member | null> {
  const email = await signedInEmail()
  return email ? getOrCreateMember(email) : null
}

// The real member, unless they've switched to a demo-group sibling's view,
// in which case that sibling (its real email, role and data) is returned instead.
export async function currentMember(): Promise<Member | null> {
  const real = await realMember()
  if (!real) return null
  const viewAs = cookies().get(VIEW_AS_COOKIE)?.value as Role | undefined
  // Admin is never reached by switching, only by signing in as an admin: otherwise anyone
  // with a demo account in an admin's group could approve learning platforms.
  if (!viewAs || viewAs === real.role || viewAs === 'admin' || !real.demoGroup) return real
  const sibling = await getMemberByGroup(real.demoGroup, viewAs)
  return sibling ?? real
}

// For API routes: the member, or an error response to return instead.
export async function requireMember(...roles: Role[]): Promise<Member | Response> {
  const member = await currentMember()
  if (!member) return Response.json({ error: 'Please sign in again.' }, { status: 401 })
  if (roles.length > 0 && !roles.includes(member.role)) return Response.json({ error: 'Not allowed.' }, { status: 403 })
  return member
}
