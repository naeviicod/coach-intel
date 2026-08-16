import { el } from '../utils.js';
import { openModal, modalActions, toast, call } from './modal.js';

// SHARE → DISCORD
//
// A contextual action for Strats, Intel, reports, match prep, and VOD items.
// Only channels that are mapped and enabled in Settings → Integrations are offered.
// Nothing but the chosen title, summary, and deep link is sent — never screenshots
// or file attachments.

/**
 * @typedef {object} ShareSpec
 * @property {string} kind        header line, e.g. 'Strat'
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [summary]
 * @property {string} [status]
 * @property {{id: string, name: string}} [team]
 * @property {string} route       Coach Intel route for the deep link
 * @property {string} [defaultPurpose]
 */

/** @param {ShareSpec} spec */
export async function openShareDialog(spec) {
  const state = await call(window.cci.discord.getState());
  if (!state) return;

  if (!state.connected) {
    toast('Connect a Discord server in Settings → Integrations first.', 'warn');
    return;
  }

  const available = (state.integration?.channels || []).filter((c) => c.enabled && c.discord_channel_id);
  if (!available.length) {
    toast('No Discord channels are configured yet. Add one in Settings → Integrations.', 'warn');
    return;
  }

  const purposes = state.catalog.purposes;
  const org = await window.cci.getOrg();
  const actor = org?.coachName || 'Coach';

  const preferred = available.find((c) => c.purpose === spec.defaultPurpose) || available[0];
  let purpose = preferred.purpose;
  const include = { title: true, summary: Boolean(spec.summary), link: true };

  const body = el('div', {});
  const overlay = openModal(body, { width: '460px' });

  const channelSelect = el(
    'select',
    { onchange: (e) => { purpose = e.target.value; } },
    available.map((c) =>
      el(
        'option',
        { value: c.purpose, selected: c.purpose === purpose ? 'selected' : null },
        `#${c.discord_channel_name}  ·  ${purposes.find((p) => p.id === c.purpose)?.label || c.purpose}`
      )
    )
  );

  const checkbox = (key, label, disabled) =>
    el('label', { class: 'discord-pref-row' }, [
      el('input', {
        type: 'checkbox',
        checked: include[key] ? 'checked' : null,
        disabled: disabled ? 'disabled' : null,
        onchange: (e) => { include[key] = e.target.checked; },
      }),
      el('div', { style: 'flex:1;font-size:12.5px;' }, label),
    ]);

  body.append(
    el('h3', {}, 'Share to Discord'),
    el('div', { class: 'field' }, [
      el('label', {}, 'Server'),
      el('div', { style: 'font-size:12.5px;font-weight:600;' }, state.integration.guild_name || '—'),
    ]),
    el('div', { class: 'field' }, [el('label', {}, 'Channel'), channelSelect]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Include'),
      checkbox('title', 'Title', false),
      checkbox('summary', 'Summary', !spec.summary),
      checkbox('link', 'Coach Intel Link', false),
    ]),
    el('div', { class: 'field-hint' }, 'Screenshots and files are never sent.')
  );

  body.append(
    modalActions([
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        onclick: async (e) => {
          const button = e.currentTarget;
          button.disabled = true;
          button.textContent = 'Sharing…';
          const result = await call(
            window.cci.discord.share({
              purpose,
              actor,
              spec: {
                kind: spec.kind,
                title: spec.title,
                subtitle: spec.subtitle,
                summary: spec.summary,
                status: spec.status,
                team: spec.team ? { id: spec.team.id, name: spec.team.name } : null,
                route: spec.route,
                include,
              },
            })
          );
          button.disabled = false;
          button.textContent = 'Share';
          if (!result) return;
          overlay.remove();
          toast(`Shared to #${result.channel}.`, 'ok');
        },
      }, 'Share'),
    ])
  );
}

/**
 * A Share → Discord button that stays hidden until we know Discord is connected,
 * so the action never appears in an organization that has not set it up.
 *
 * @param {() => ShareSpec} specFactory  evaluated on click, so it can read live state
 */
export function shareButton(specFactory, { label = 'Share → Discord', className = 'btn subtle' } = {}) {
  const button = el('button', {
    class: className,
    style: 'display:none;',
    onclick: () => openShareDialog(specFactory()),
  }, label);

  window.cci.discord
    .getState()
    .then((result) => {
      const connected = result?.ok && result.data?.connected;
      const hasChannel = (result?.data?.integration?.channels || []).some((c) => c.enabled && c.discord_channel_id);
      if (connected && hasChannel) button.style.display = '';
    })
    .catch(() => {});

  return button;
}
