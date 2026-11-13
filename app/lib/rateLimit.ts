// A simple per-IP limit for the sign-in routes, per server instance.
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60_000
const hits = new Map<string, number[]>()

export function rateLimited(req: Request, bucket: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const recent = (hits.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > RATE_LIMIT
}

export const tooMany = () => Response.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 })
