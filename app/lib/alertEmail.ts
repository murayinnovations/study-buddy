// The email admins get when a learning platform registers and waits for approval.
// Kept free of other imports so scripts/preview-alert-email.mts can render it as-is.
// The platform's address and name come from whoever registered, so both are escaped.

export interface AlertPlatform { issuer: string; name: string | null; created_at: string }

const escape = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const PRODUCTS: Record<string, string> = {
  moodle: 'Moodle', canvas: 'Canvas', blackboard: 'Blackboard', sakai: 'Sakai',
  desire2learn: 'Brightspace', d2l: 'Brightspace', brightspace: 'Brightspace', schoology: 'Schoology',
}

// The platform's product, e.g. 'moodle' → 'Moodle'.
function productName(code: string | null) {
  const key = (code ?? '').trim().toLowerCase()
  if (!key) return 'A learning platform'
  return PRODUCTS[key] ?? (key[0].toUpperCase() + key.slice(1)).slice(0, 40)
}

export function alertEmail(p: AlertPlatform, siteUrl: string) {
  const product = productName(p.name)
  const host = (() => { try { return new URL(p.issuer).host } catch { return p.issuer } })()
  const when = new Date(p.created_at).toLocaleString('en-GB', {
    timeZone: 'Africa/Nairobi', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + ' (Nairobi time)'

  // The platform's address stays out of the subject and isn't a link: a link to an unknown
  // site next to an "approve" button is what phishing looks like, and Gmail files it as spam.
  const subject = product === 'A learning platform'
    ? 'Approval needed: a learning platform wants to connect to Curriculum AI'
    : `Approval needed: a ${product} site wants to connect to Curriculum AI`

  const text = [
    `${product} at ${host} has registered to open Curriculum AI and is waiting for your approval.`,
    '',
    `Platform:   ${product}`,
    `Address:    ${host}`,
    `Registered: ${when}`,
    '',
    'Nobody can open Curriculum AI from it until an admin approves it. Only approve platforms you',
    'recognise: an approved platform can sign its students and lecturers in to Curriculum AI.',
    '',
    `Review it on the admin page: ${siteUrl}`,
    '',
    "You're getting this because you're a Curriculum AI admin.",
  ].join('\n')

  const row = (label: string, value: string) => `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#64748B;width:96px;vertical-align:top">${label}</td>
                <td style="padding:6px 0;font-size:13px;color:#0F172A;font-weight:600;word-break:break-all">${value}</td>
              </tr>`

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden">
        <tr><td style="background:#0F172A;padding:18px 28px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;height:32px;background:#2563EB;border-radius:9px;text-align:center;vertical-align:middle;color:#FFFFFF;font-weight:700;font-size:15px">C</td>
            <td style="padding-left:10px;color:#FFFFFF;font-weight:600;font-size:15px">Curriculum AI</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:28px 28px 8px">
          <div style="display:inline-block;font-size:11px;font-weight:600;color:#92400E;background:#FEF3C7;border-radius:999px;padding:4px 10px">Waiting for approval</div>
          <h1 style="font-size:20px;line-height:1.35;color:#0F172A;margin:14px 0 8px">${escape(product)} wants to connect to Curriculum AI</h1>
          <p style="font-size:14px;line-height:1.6;color:#475569;margin:0">
            A ${escape(product)} site has registered Curriculum AI as a tool. Nobody can open Curriculum AI from it until an admin approves it.
          </p>
        </td></tr>

        <tr><td style="padding:16px 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 16px">
            ${row('Platform', escape(product))}
            ${row('Address', escape(host))}
            ${row('Registered', escape(when))}
          </table>
        </td></tr>

        <tr><td style="padding:20px 28px 8px">
          <a href="${escape(siteUrl)}" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px">Review and approve</a>
        </td></tr>

        <tr><td style="padding:16px 28px 28px">
          <p style="font-size:12px;line-height:1.6;color:#64748B;margin:0;border-left:3px solid #F59E0B;padding-left:12px">
            Only approve platforms you recognise. An approved platform can sign its students and lecturers in to Curriculum AI.
            If you don't recognise this address, reject it on the admin page.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#94A3B8;margin:16px 0 0">You're getting this because you're a Curriculum AI admin.</p>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
