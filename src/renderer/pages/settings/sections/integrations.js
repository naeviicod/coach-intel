import { el } from '../../../utils.js';

export async function render(panel, ctx) {
  const state = await window.cci.discord.getState();
  const discord = state?.ok ? state.data : null;
  const connected = Boolean(discord?.connected);
  const label = discord?.statusLabel || 'Not Connected';
  const tone = connected && discord.status === 'CONNECTED' ? 'win' : null;

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Connected Services'),
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { class: 'settings-row-title' }, 'Discord'),
          el(
            'div',
            { class: 'field-hint', style: 'max-width:520px;line-height:1.5;' },
            connected
              ? `Posting to ${discord.integration?.guild_name || 'your server'}. Strats, Intel, match reports and alerts can be sent to approved channels.`
              : 'Send Coach Intel notifications, Strats and Intel into your team\'s Discord server. Coach Intel never reads your messages.'
          ),
        ]),
        el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
          el('span', { class: tone ? `pill ${tone}` : 'role-badge' }, label),
          el('button', { class: 'btn', onclick: () => ctx.navigate('integrations') }, connected ? 'Manage' : 'Set Up'),
        ]),
      ]),
    ])
  );

  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'External Data'),
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { class: 'settings-row-title' }, 'Breaking Point'),
          el(
            'div',
            { class: 'field-hint', style: 'max-width:520px;line-height:1.5;' },
            'Not connected. Breaking Point\'s terms reserve rights to their data — a live connector needs a verified API (or a rate-limited, ToS-compliant fallback) before it ships, so no automatic sync runs yet. Manual entry and CSV import remain the way to bring outside stats in.'
          ),
        ]),
        el('span', { class: 'role-badge' }, 'Not Connected'),
      ]),
    ])
  );
}
