import { publicKey } from '../../lib/lti'

// Curriculum AI's public key, so the learning platform can check messages we sign.

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ keys: [await publicKey()] }, { headers: { 'cache-control': 'public, max-age=3600' } })
}
