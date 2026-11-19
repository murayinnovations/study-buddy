import { NextResponse, type NextRequest } from 'next/server'
import { findPlatform, newNonce, page, platformBlocked, STATE_COOKIE } from '../../lib/lti'

// Step 1 of a launch: the platform sends the person here, and we send them straight
// back to the platform's sign-in address with a one-time code. The platform then
// posts the signed launch to /lti/launch.

export const dynamic = 'force-dynamic'

async function login(req: NextRequest, params: URLSearchParams) {
  const issuer = params.get('iss')
  const loginHint = params.get('login_hint')
  if (!issuer || !loginHint) return page('Could not open Study Buddy', 'The learning platform sent an incomplete request.', 400)

  const platform = await findPlatform(issuer, params.get('client_id') ?? undefined)
  if (!platform) return page('Could not open Study Buddy', 'This learning platform is not registered with Study Buddy.', 403)
  const blocked = platformBlocked(platform)
  if (blocked) return page('Could not open Study Buddy', blocked, 403)

  const state = crypto.randomUUID()
  const auth = new URL(platform.auth_url)
  auth.search = new URLSearchParams({
    scope: 'openid',
    response_type: 'id_token',
    response_mode: 'form_post',
    prompt: 'none',
    client_id: platform.client_id,
    redirect_uri: `${req.nextUrl.origin}/lti/launch`,
    login_hint: loginHint,
    state,
    nonce: await newNonce(),
    ...(params.get('lti_message_hint') ? { lti_message_hint: params.get('lti_message_hint')! } : {}),
  }).toString()

  // Ties the launch to this browser. The launch arrives as a post from the platform's
  // site, so the cookie must be sent cross-site.
  const res = NextResponse.redirect(auth, 302)
  res.cookies.set(STATE_COOKIE + state, '1', { httpOnly: true, secure: true, sameSite: 'none', path: '/lti/launch', maxAge: 600 })
  return res
}

export async function GET(req: NextRequest) {
  return login(req, req.nextUrl.searchParams)
}

export async function POST(req: NextRequest) {
  return login(req, new URLSearchParams(await req.text()))
}
