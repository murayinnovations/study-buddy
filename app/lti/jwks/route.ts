import { publicKey, LtiError } from '../../lib/lti'

// Curriculum AI's public key, so the learning platform can check messages we sign.

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return Response.json({ keys: [await publicKey()] }, { headers: { 'cache-control': 'public, max-age=3600' } })
  } catch (err) {
    // Says what's wrong with the key setting, never anything about the key itself.
    console.error('LTI public key failed:', err)
    const error = err instanceof LtiError ? err.message : 'Could not load the key.'
    return Response.json({ error }, { status: 500 })
  }
}
