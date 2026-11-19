import { z } from 'zod/v4'
import { requireMember } from '../../../lib/auth'
import { listPlatforms, reviewPlatform, REJECTED_KEEP_DAYS } from '../../../lib/lti'

// The learning platforms registered to open Study Buddy, for admins to approve.

export const dynamic = 'force-dynamic'

export async function GET() {
  const member = await requireMember('admin')
  if (member instanceof Response) return member
  const platforms = await listPlatforms()
  return Response.json({
    platforms: platforms.map(p => ({
      id: p.id, issuer: p.issuer, name: p.name, status: p.status, deployments: p.deployment_ids.length,
      registeredAt: p.created_at, reviewedBy: p.reviewed_by, reviewedAt: p.reviewed_at,
      // When a rejected platform will be deleted from the list.
      deleteOn: p.status === 'rejected' && p.reviewed_at
        ? new Date(new Date(p.reviewed_at).getTime() + REJECTED_KEEP_DAYS * 86_400_000).toISOString() : null,
    })),
  })
}

// reject turns down a waiting platform or revokes an approved one.
const Body = z.object({ id: z.number().int(), action: z.enum(['approve', 'reject']) })

export async function POST(req: Request) {
  const member = await requireMember('admin')
  if (member instanceof Response) return member
  let body
  try { body = Body.parse(await req.json()) } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }) }
  await reviewPlatform(body.id, body.action, member.email)
  return Response.json({ ok: true })
}
