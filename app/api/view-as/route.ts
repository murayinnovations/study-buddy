import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { realMember, VIEW_AS_COOKIE, ROLES } from '../../lib/auth'
import { getMemberByGroup } from '../../lib/db'
import type { Role } from '../../lib/demoData'

// Switches the signed-in member's view to a sibling account in the same demo
// group (or back to their own), for presenting all three roles from one window.
export async function POST(req: NextRequest) {
  const real = await realMember()
  if (!real) return Response.json({ error: 'Please sign in again.' }, { status: 401 })

  const { role } = await req.json().catch(() => ({ role: undefined }))
  if (typeof role !== 'string' || !ROLES.includes(role as Role)) return Response.json({ error: 'Invalid role.' }, { status: 400 })

  if (role !== real.role) {
    if (!real.demoGroup) return Response.json({ error: 'This account cannot switch views.' }, { status: 403 })
    const sibling = await getMemberByGroup(real.demoGroup, role as Role)
    if (!sibling) return Response.json({ error: 'No account for that view in this demo group.' }, { status: 404 })
  }

  cookies().set(VIEW_AS_COOKIE, role, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 })
  return Response.json({ ok: true })
}
