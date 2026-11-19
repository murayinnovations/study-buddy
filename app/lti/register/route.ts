import { type NextRequest } from 'next/server'
import { notifyAdmins, page, publicUrl, savePlatform, ROSTER_SCOPE, TOOL_CONFIG } from '../../lib/lti'

// Registering Curriculum AI with a learning platform (LTI Dynamic Registration).
// The platform's admin pastes this address into the platform; it opens here with
// the platform's settings address and a one-time token, we register ourselves
// there, save what the platform sends back and tell its page we're done.
// A new platform then waits for one of our admins to approve it.

export const dynamic = 'force-dynamic'

const fail = (message: string) => page('Registration failed', message, 400)

export async function GET(req: NextRequest) {
  const configUrl = publicUrl(req.nextUrl.searchParams.get('openid_configuration'))
  const token = req.nextUrl.searchParams.get('registration_token')
  if (!configUrl) return fail('Open this address from the learning platform’s tool registration page. The platform must be on a public HTTPS address.')

  const auth = token ? { authorization: `Bearer ${token}` } : undefined
  let config: Record<string, any>
  try {
    const res = await fetch(configUrl, { headers: { accept: 'application/json', ...auth }, cache: 'no-store', redirect: 'error' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    config = await res.json()
  } catch (err) {
    console.error('LTI registration: reading platform settings failed:', err)
    return fail('Could not read the learning platform’s settings. Please try again.')
  }

  // The settings must come from the platform they describe.
  const issuer = typeof config.issuer === 'string' ? config.issuer.replace(/\/$/, '') : ''
  if (!publicUrl(issuer) || !configUrl.href.startsWith(issuer + '/')) {
    return fail('The learning platform’s settings name a different platform than the one registering.')
  }
  const registrationUrl = publicUrl(config.registration_endpoint)
  const authUrl = publicUrl(config.authorization_endpoint)
  const jwksUrl = publicUrl(config.jwks_uri)
  if (!registrationUrl || !authUrl || !jwksUrl) {
    return fail('The learning platform’s settings are missing addresses Curriculum AI needs.')
  }

  const origin = req.nextUrl.origin
  const launch = `${origin}/lti/launch`
  let registration: Record<string, any>
  try {
    const res = await fetch(registrationUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...auth },
      cache: 'no-store',
      redirect: 'error',
      body: JSON.stringify({
        application_type: 'web',
        client_name: 'Curriculum AI',
        response_types: ['id_token'],
        grant_types: ['implicit', 'client_credentials'],
        initiate_login_uri: `${origin}/lti/login`,
        redirect_uris: [launch],
        jwks_uri: `${origin}/lti/jwks`,
        token_endpoint_auth_method: 'private_key_jwt',
        scope: ROSTER_SCOPE,
        [TOOL_CONFIG]: {
          domain: req.nextUrl.host,
          target_link_uri: launch,
          description: 'AI study companion grounded in the course materials.',
          // Name and email are needed to set up each person's account.
          claims: ['iss', 'sub', 'name', 'given_name', 'family_name', 'email'],
          messages: [{ type: 'LtiResourceLinkRequest', target_link_uri: launch, label: 'Curriculum AI' }],
        },
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    registration = await res.json()
  } catch (err) {
    console.error('LTI registration: registering with the platform failed:', err)
    return fail('The learning platform did not accept the registration. Please try again.')
  }
  if (typeof registration.client_id !== 'string') return fail('The learning platform did not send back an id for Curriculum AI.')

  const deployment = registration[TOOL_CONFIG]?.deployment_id
  const { isNew, platform } = await savePlatform({
    issuer,
    client_id: registration.client_id,
    deployment_ids: deployment ? [String(deployment)] : [],
    auth_url: authUrl.href,
    token_url: publicUrl(config.token_endpoint)?.href ?? null,
    jwks_url: jwksUrl.href,
    name: config['https://purl.imsglobal.org/spec/lti-platform-configuration']?.product_family_code ?? null,
  })
  if (isNew) await notifyAdmins(platform, origin)

  // Tells the platform's registration page to close this window and finish.
  return page('Curriculum AI is registered',
    platform.status === 'approved'
      ? 'You can close this window. Lecturers can now add Curriculum AI to a course as an activity.'
      : 'You can close this window. The Curriculum AI team has been told and will approve this platform; until then, the activity shows a waiting message.',
    200, "(window.opener || window.parent).postMessage({ subject: 'org.imsglobal.lti.close' }, '*')")
}
