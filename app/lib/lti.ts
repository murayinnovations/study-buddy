import { createRemoteJWKSet, decodeJwt, exportJWK, importPKCS8, calculateJwkThumbprint, jwtVerify, type JWK } from 'jose'
import { db, check, getMember, forgetMember, getCourse, type CourseConfig } from './db'
import type { Role } from './demoData'
import { alertEmail } from './alertEmail'

// Opening Study Buddy from a learning platform such as Moodle, with LTI 1.3.
// The routes in app/lti use this: register (the platform's admin adds the tool),
// login and launch (someone clicks the activity), jwks (our public key).
//
// A launch is a token signed by the platform saying who the person is, which
// course they're in and their role there. Once it checks out, they're signed in
// as the matching member, who is created on their first launch.

const LTI = 'https://purl.imsglobal.org/spec/lti/claim/'
const LIS = 'http://purl.imsglobal.org/vocab/lis/v2/'
export const TOOL_CONFIG = 'https://purl.imsglobal.org/spec/lti-tool-configuration'
// Read-only class list, asked for at registration so a later class-list feature needs no re-registration.
export const ROSTER_SCOPE = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'

// Something the person (or the platform's admin) needs to fix; shown on the error page.
export class LtiError extends Error {}

// ---- Our key ----

// The key Study Buddy signs with, from LTI_PRIVATE_KEY (make one with scripts/lti-key.mjs).
// Launches don't need it, but the platform asks for our public key at registration.
let toolKey: Promise<JWK> | null = null

// The key as PEM, however it was pasted into the hosting settings: with or without the
// LTI_PRIVATE_KEY= name and quotes, with \n for line breaks, or with the breaks lost.
export function keyPem(raw: string | undefined): string {
  if (!raw?.trim()) throw new LtiError('LTI_PRIVATE_KEY is not set (make one with scripts/lti-key.mjs).')
  const value = raw.trim().replace(/^LTI_PRIVATE_KEY\s*=\s*/, '').replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')
  const body = value.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/)?.[1].replace(/\s+/g, '')
  if (!body) throw new LtiError('LTI_PRIVATE_KEY is not a key from scripts/lti-key.mjs: it should run from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----.')
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`
}

export function publicKey(): Promise<JWK> {
  toolKey ??= (async () => {
    let key
    try { key = await importPKCS8(keyPem(process.env.LTI_PRIVATE_KEY), 'RS256', { extractable: true }) } catch (err) {
      throw err instanceof LtiError ? err : new LtiError('LTI_PRIVATE_KEY could not be read as a key. Make a new one with scripts/lti-key.mjs.')
    }
    const { kty, n, e } = await exportJWK(key)
    const jwk: JWK = { kty, n, e }
    return { ...jwk, kid: await calculateJwkThumbprint(jwk), alg: 'RS256', use: 'sig' }
  })()
  toolKey.catch(() => { toolKey = null })
  return toolKey
}

// ---- Platforms ----

export type PlatformStatus = 'pending' | 'approved' | 'rejected'

export interface Platform {
  id: number; issuer: string; client_id: string; deployment_ids: string[]
  auth_url: string; token_url: string | null; jwks_url: string; name: string | null
  status: PlatformStatus; reviewed_by: string | null; reviewed_at: string | null; created_at: string
}

type Registration = Pick<Platform, 'issuer' | 'client_id' | 'deployment_ids' | 'auth_url' | 'token_url' | 'jwks_url' | 'name'>

// Registration fetches addresses the platform hands us, so it only follows public HTTPS
// ones (and any http or https address while developing, for a local Moodle).
export function publicUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (process.env.NODE_ENV !== 'production') return url
  const host = url.hostname
  const internal = host === 'localhost' || /\.(localhost|local|internal)$/.test(host) || /^[\d.]+$/.test(host) || host.includes(':')
  return url.protocol === 'https:' && !internal ? url : null
}

// Anyone can register, but a platform can sign people in, so a new one waits for an
// admin's approval. Registering again (same platform and id) keeps its status.
// Returns whether the platform is new.
export async function savePlatform(p: Registration): Promise<{ isNew: boolean; platform: Platform }> {
  const existing = check(await db().from('lti_platforms').select('id').match({ issuer: p.issuer, client_id: p.client_id }).maybeSingle())
  const platform: Platform = existing
    ? check(await db().from('lti_platforms').update(p).eq('id', existing.id).select().single())
    : check(await db().from('lti_platforms').insert(p).select().single())
  return { isNew: !existing, platform }
}

// Rejected platforms are kept this long, so admins can see what was turned down, then deleted.
export const REJECTED_KEEP_DAYS = 30

// For the admin page: waiting platforms first, then approved, then rejected. Rejected ones
// past REJECTED_KEEP_DAYS are deleted here, so no scheduled job is needed.
export async function listPlatforms(): Promise<Platform[]> {
  const cutoff = new Date(Date.now() - REJECTED_KEEP_DAYS * 86_400_000).toISOString()
  check(await db().from('lti_platforms').delete().eq('status', 'rejected').lt('reviewed_at', cutoff))
  const rows: Platform[] = check(await db().from('lti_platforms').select('*').order('created_at', { ascending: false }))
  const order: PlatformStatus[] = ['pending', 'approved', 'rejected']
  return order.flatMap(status => rows.filter(p => p.status === status))
}

// Approves a waiting platform, or rejects a waiting one or revokes an approved one. A rejected
// platform can't be approved again: it's deleted after REJECTED_KEEP_DAYS, and to connect again
// its admin registers again, which arrives as a new request.
export async function reviewPlatform(id: number, decision: 'approve' | 'reject', by: string) {
  const from: PlatformStatus[] = decision === 'approve' ? ['pending'] : ['pending', 'approved']
  check(await db().from('lti_platforms')
    .update({ status: decision === 'approve' ? 'approved' : 'rejected', reviewed_by: by, reviewed_at: new Date().toISOString() })
    .eq('id', id).in('status', from))
}

// Emails every admin that a platform is waiting for approval, through Resend.
// A failed email doesn't fail the registration: the platform still shows on the admin page.
export async function notifyAdmins(p: Platform, siteUrl: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return console.warn('RESEND_API_KEY is not set, so no email was sent for the new platform', p.issuer)
  try {
    const admins = check(await db().from('members').select('email').eq('role', 'admin')).map(m => m.email as string)
    if (admins.length === 0) return console.warn('No admins to email about the new platform', p.issuer)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL || 'Study Buddy <onboarding@resend.dev>',
        to: admins,
        ...alertEmail(p, siteUrl),
      }),
    })
    if (!res.ok) console.error('Emailing admins about the new platform failed:', res.status, await res.text())
  } catch (err) {
    console.error('Emailing admins about the new platform failed:', err)
  }
}

// Why a platform can't be used yet, or null if it can.
export function platformBlocked(p: Platform): string | null {
  if (p.status === 'pending') return 'The Study Buddy team has not approved this learning platform yet. Please try again later.'
  if (p.status === 'rejected') return 'This learning platform is not registered with Study Buddy.'
  return null
}

// The platform a login or launch comes from. Without a client id, the platform must
// have registered Study Buddy only once.
export async function findPlatform(issuer: string, clientId?: string): Promise<Platform | null> {
  let query = db().from('lti_platforms').select('*').eq('issuer', issuer)
  if (clientId) query = query.eq('client_id', clientId)
  const rows: Platform[] = check(await query.limit(2))
  return rows.length === 1 ? rows[0] : null
}

// ---- One-time codes ----

// Set by /lti/login and checked by /lti/launch, to tie a launch to the browser that started it.
export const STATE_COOKIE = 'lti_state_'

const NONCE_TTL_MS = 10 * 60_000

export async function newNonce() {
  const nonce = crypto.randomUUID()
  // Old codes are cleared as new ones are made, so the table stays small.
  await Promise.all([
    db().from('lti_nonces').insert({ nonce, expires_at: new Date(Date.now() + NONCE_TTL_MS).toISOString() }).then(check),
    db().from('lti_nonces').delete().lt('expires_at', new Date().toISOString()).then(check),
  ])
  return nonce
}

// Uses a code up. False if it was never made, has expired or was already used.
async function useNonce(nonce: string) {
  const rows = check(await db().from('lti_nonces').delete().eq('nonce', nonce)
    .gt('expires_at', new Date().toISOString()).select('nonce'))
  return rows.length === 1
}

// ---- Checking a launch ----

export interface Launch {
  platform: Platform
  sub: string
  email: string | null
  name: string
  role: Exclude<Role, 'hod'> | null
  contextId: string | null
  contextTitle: string | null
  courseParam: string | null   // the activity's course=<code> custom parameter
  sourcedId: string | null     // the platform's student number for the person, if it has one
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()
const keySet = (url: string) => {
  if (!keySets.has(url)) keySets.set(url, createRemoteJWKSet(new URL(url)))
  return keySets.get(url)!
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// Platform roles to ours. Admins get no special role: HoD is only ever set by hand.
function toRole(roles: unknown): Launch['role'] {
  const list = Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : []
  const has = (role: string) => list.some(r => r === `${LIS}membership#${role}` || r.startsWith(`${LIS}membership/${role}#`) || r === role)
  if (has('Instructor')) return 'lecturer'
  if (has('Learner')) return 'student'
  return null
}

export async function checkLaunch(idToken: string): Promise<Launch> {
  let unverified
  try { unverified = decodeJwt(idToken) } catch { throw new LtiError('The launch from the learning platform was not readable.') }
  const aud = unverified.aud
  const clientId = Array.isArray(aud) ? str(unverified.azp) ?? (aud.length === 1 ? aud[0] : null) : str(aud)
  const platform = unverified.iss && clientId ? await findPlatform(unverified.iss, clientId) : null
  if (!platform) throw new LtiError('This learning platform is not registered with Study Buddy.')
  const blocked = platformBlocked(platform)
  if (blocked) throw new LtiError(blocked)

  let claims
  try {
    ({ payload: claims } = await jwtVerify(idToken, keySet(platform.jwks_url), {
      issuer: platform.issuer, audience: platform.client_id, algorithms: ['RS256'], maxTokenAge: '10m',
    }))
  } catch {
    throw new LtiError('The launch from the learning platform could not be verified. Please open Study Buddy from the course again.')
  }
  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== platform.client_id) {
    throw new LtiError('The launch was meant for a different tool.')
  }
  if (typeof claims.nonce !== 'string' || !(await useNonce(claims.nonce))) {
    throw new LtiError('This launch link has already been used or has expired. Please open Study Buddy from the course again.')
  }
  if (claims[`${LTI}message_type`] !== 'LtiResourceLinkRequest' || claims[`${LTI}version`] !== '1.3.0') {
    throw new LtiError('The learning platform sent a kind of launch Study Buddy does not support.')
  }

  const deployment = str(claims[`${LTI}deployment_id`])
  if (!deployment) throw new LtiError('The launch did not say which installation of Study Buddy it came from.')
  if (!platform.deployment_ids.includes(deployment)) {
    // Registration normally records the deployment. If the platform didn't send one then,
    // the first launch records it; any other deployment is refused.
    if (platform.deployment_ids.length > 0) throw new LtiError('This installation of Study Buddy is not registered.')
    check(await db().from('lti_platforms').update({ deployment_ids: [deployment] }).eq('id', platform.id))
  }

  const sub = str(claims.sub)
  if (!sub) throw new LtiError('The learning platform did not say who you are.')
  const context = (claims[`${LTI}context`] ?? {}) as Record<string, unknown>
  const custom = (claims[`${LTI}custom`] ?? {}) as Record<string, unknown>
  const lis = (claims[`${LTI}lis`] ?? {}) as Record<string, unknown>
  const email = str(claims.email)?.toLowerCase() ?? null
  const fullName = str(claims.name) ?? ([str(claims.given_name), str(claims.family_name)].filter(Boolean).join(' ') || null)

  return {
    platform, sub, email,
    name: fullName ?? email ?? 'Learner',
    role: toRole(claims[`${LTI}roles`]),
    contextId: str(context.id),
    contextTitle: str(context.title),
    courseParam: str(custom.course),
    sourcedId: str(lis.person_sourcedid),
  }
}

// ---- The course and the member ----

// The course this activity opens: from its course=<code> parameter, which is remembered
// for the platform course, or else from what was remembered last time.
export async function launchCourse(l: Launch): Promise<CourseConfig> {
  if (l.courseParam) {
    const course = await getCourse(l.courseParam)
    if (!course) throw new LtiError(`This activity is set to open the course "${l.courseParam}", which Study Buddy doesn't have. Ask the lecturer to check the course code in the activity's settings.`)
    if (l.contextId) {
      check(await db().from('lti_courses').upsert({
        platform_id: l.platform.id, context_id: l.contextId, course: course.code, title: l.contextTitle, updated_at: new Date().toISOString(),
      }))
    }
    return course
  }
  const row = l.contextId
    ? check(await db().from('lti_courses').select('course').match({ platform_id: l.platform.id, context_id: l.contextId }).maybeSingle())
    : null
  const course = row && await getCourse(row.course)
  if (!course) throw new LtiError("This activity isn't linked to a Study Buddy course yet. Ask the lecturer to add course=<course code> to the activity's custom parameters.")
  return course
}

// The member to sign in as: whoever this platform user opened Study Buddy as before,
// else the member with their email, else a new member made from the launch.
// Existing members keep their role and details; only new ones take them from the platform.
export async function launchMember(l: Launch, course: CourseConfig): Promise<string> {
  const linked = check(await db().from('lti_identities').select('email')
    .match({ platform_id: l.platform.id, sub: l.sub }).maybeSingle())
  if (linked) return linked.email

  if (!l.email) {
    throw new LtiError("The learning platform didn't share your email address, which Study Buddy needs to set up your account. Ask the platform's administrator to set the tool to share the user's email.")
  }
  if (!(await getMember(l.email))) {
    if (!l.role) throw new LtiError('Open Study Buddy from a course you teach or are enrolled in.')
    check(await db().from('members').upsert({
      email: l.email, role: l.role, name: l.name,
      student_id: l.role === 'student' ? await studentNumber(l) : null,
      course: l.role === 'lecturer' ? course.code : null,
    }, { onConflict: 'email', ignoreDuplicates: true }))
    forgetMember(l.email)
  }
  check(await db().from('lti_identities').upsert(
    { platform_id: l.platform.id, sub: l.sub, email: l.email },
    { onConflict: 'platform_id,sub', ignoreDuplicates: true }))
  return l.email
}

// Every student needs a unique student number: the platform's if it sends a free one,
// otherwise one made from the platform user id.
async function studentNumber(l: Launch) {
  if (l.sourcedId) {
    const taken = check(await db().from('members').select('email').eq('student_id', l.sourcedId).maybeSingle())
    if (!taken) return l.sourcedId
  }
  return `LTI-${l.platform.id}-${l.sub}`
}

// ---- Pages ----

const escape = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

// A plain page for the end of registration and for launch errors. script runs on the page.
export function page(title: string, message: string, status = 200, script = '') {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Study Buddy</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#F8FAFC;font-family:system-ui,sans-serif}
div{max-width:440px;background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:28px}
h1{font-size:17px;color:#0F172A;margin:0}p{font-size:13px;color:#64748B;line-height:1.6;margin:8px 0 0}</style></head>
<body><div><h1>${escape(title)}</h1><p>${escape(message)}</p></div>${script ? `<script>${script}</script>` : ''}</body></html>`
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}
