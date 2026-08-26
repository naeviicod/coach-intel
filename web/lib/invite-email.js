import { DEFAULT_ACCENT, accentInk, normalizeHex } from './accent.js';
import { inviteChips, invitePlacement } from './invite.js';

const SITE = 'https://coach.championshipseries.eu';
const UI = 'Arial,Helvetica,sans-serif';
const DISPLAY = "Georgia,'Times New Roman',Times,serif";
const CANVAS = '#14181c';
const PANEL = '#1c2127';
const PAPER = '#ebe6d6';
const INK = '#161410';
const MUTED = '#5c5850';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function inviteEmailSubject({ who, org } = {}) {
  const name = String(who || '').trim() || 'you';
  const orgName = String(org || '').trim() || 'the organization';
  return `${name}, you've been invited to ${orgName}`;
}

export function inviteEmailText({
  who = '',
  org = '',
  team = '',
  role = 'Player',
  playRole = '',
  slot = '',
  url = `${SITE}/join/preview`,
  email = '',
} = {}) {
  const chips = inviteChips({ team, playRole, slot, accessRole: role });
  const place = invitePlacement({ team, playRole, slot });
  return [
    `${who}, you've been invited to ${org} on Coach Intel${place}.`,
    chips.join(' · '),
    `Open your invite: ${url}`,
    `Signed for ${email}. This link binds your Discord to that roster slot. It expires in 14 days.`,
    'Coach Intel — Know More. Win More.',
  ].filter(Boolean).join('\n\n');
}

export function renderInviteEmail({
  who = '',
  email = '',
  org = '',
  team = '',
  role = 'Player',
  playRole = '',
  slot = '',
  url = `${SITE}/join/preview`,
  accent = DEFAULT_ACCENT,
  ciLogoSrc = '',
  wordmarkSrc = '',
  orgLogoSrc = '',
  teamLogoSrc = '',
} = {}) {
  const name = escapeHtml(who);
  const orgName = escapeHtml(org);
  const teamName = escapeHtml(team);
  const chips = inviteChips({ team, playRole, slot, accessRole: role }).map(escapeHtml);
  const place = escapeHtml(invitePlacement({ team, playRole, slot }));
  const to = escapeHtml(email);
  const href = escapeHtml(url);
  const ciLogo = escapeHtml(ciLogoSrc);
  const wordmark = escapeHtml(wordmarkSrc);
  const orgLogo = escapeHtml(orgLogoSrc);
  const teamLogo = escapeHtml(teamLogoSrc);
  const paint = normalizeHex(accent) || DEFAULT_ACCENT;
  const ink = accentInk(paint);
  const meta = chips.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;">
                <tr>
                  ${chips.map((chip) => `<td style="padding:0 8px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:8px 14px;border:1px solid ${paint};border-radius:999px;font-family:${UI};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK};">${chip}</td>
                      </tr>
                    </table>
                  </td>`).join('')}
                </tr>
              </table>` : '';

  const brand = ciLogo
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle"><img src="${ciLogo}" width="40" height="40" alt="" style="display:block;border:0;border-radius:12px;width:40px;height:40px;" /></td>
                  ${wordmark ? `<td valign="middle" style="padding-left:10px;"><img src="${wordmark}" width="118" alt="Coach Intel" style="display:block;border:0;border-radius:8px;width:118px;height:auto;" /></td>` : `<td valign="middle" style="padding-left:10px;font-family:${UI};font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#f4f6f8;">Coach Intel</td>`}
                </tr>
              </table>`
    : `<p style="margin:0;font-family:${UI};font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${paint};">Coach Intel</p>`;

  const seals = (orgLogo && teamLogo) ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;">
                <tr>
                  <td valign="bottom" style="padding-right:22px;">
                    <img src="${orgLogo}" width="108" height="108" alt="${orgName}" style="display:block;border:2px solid ${paint};border-radius:54px;width:108px;height:108px;" />
                    <p style="margin:10px 0 0;font-family:${UI};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${paint};">${orgName || 'Org'}</p>
                  </td>
                  <td valign="bottom">
                    <img src="${teamLogo}" width="72" height="72" alt="${teamName}" style="display:block;border:2px solid #3a4148;border-radius:36px;width:72px;height:72px;" />
                    <p style="margin:10px 0 0;font-family:${UI};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#d7d2c8;">${teamName || 'Team'}</p>
                  </td>
                </tr>
              </table>` : '';
  const kicker = `<p style="margin:${seals ? '22px' : '18px'} 0 0;font-family:${UI};font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#f4f6f8;">You've been invited</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${inviteEmailSubject({ who, org })}</title>
</head>
<body bgcolor="${CANVAS}" style="margin:0;padding:0;background-color:${CANVAS};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${name} — ${orgName} selected you for Coach Intel.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CANVAS}">
    <tr>
      <td align="center" bgcolor="${CANVAS}" style="padding:32px 16px 44px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="${PANEL}" style="width:560px;max-width:560px;border-radius:24px;overflow:hidden;">
          <tr>
            <td bgcolor="${PANEL}" style="padding:28px 32px 22px;border-radius:24px 24px 0 0;">
              ${brand}
              ${seals}
              ${kicker}
            </td>
          </tr>
          <tr>
            <td bgcolor="${PAPER}" style="padding:28px 32px 30px;border-radius:0 0 24px 24px;">
              <h1 style="margin:0;font-family:${DISPLAY};font-size:34px;line-height:1.05;font-weight:700;color:${INK};">Join ${orgName}</h1>
              <p style="margin:14px 0 0;max-width:420px;font-family:${UI};font-size:15px;line-height:1.55;color:${INK};">
                ${name}, you've been invited to ${orgName} on Coach Intel${place}.
              </p>
              ${meta}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
                <tr>
                  <td bgcolor="${paint}" align="left" style="padding:13px 24px;border-radius:999px;">
                    <a href="${href}" style="display:inline-block;font-family:${UI};font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${ink};text-decoration:none;">
                      <font color="${ink}">Open your invite</font>
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;font-family:${UI};font-size:12px;line-height:1.5;color:${MUTED};">
                Signed for ${to}. This link binds your Discord to that roster slot. It expires in 14 days.
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
          <tr>
            <td style="padding:18px 8px 0;">
              <p style="margin:0;font-family:${UI};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${paint};">Know More. Win More.</p>
              <p style="margin:8px 0 0;font-family:${UI};font-size:11px;line-height:1.5;color:#8a8680;">
                <a href="${href}" style="color:#8a8680;text-decoration:none;">${href.replace(/^https:\/\//, '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
