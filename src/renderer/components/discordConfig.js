import { el } from '../utils.js';
import { toast, call } from './modal.js';

// Channel mapping, notification preferences, and the audit trail for a connected
// Discord server. Rendered inside the Integrations page.

const SENSITIVITY_ORDER = ['PUBLIC_TEAM', 'COACHING_STAFF', 'RESTRICTED'];

function channelLabel(channel) {
  const base = `#${channel.name}`;
  if (!channel.canPost) return `${base}  ✕ missing permission`;
  return channel.category ? `${base}  ·  ${channel.category}` : base;
}

/**
 * DISCORD CHANNELS — maps each Coach Intel purpose to a Discord channel.
 * Channel IDs are stored internally; names are only for display.
 */
export function channelsCard({ integration, channels, catalog, actor, onSaved }) {
  const card = el('div', { class: 'card section' });
  const draft = new Map(
    (integration.channels || []).map((c) => [c.purpose, { ...c }])
  );

  const usable = channels.filter((c) => c.canPost);
  const unusable = channels.filter((c) => !c.canPost);

  card.append(
    el('div', { class: 'section-title' }, [
      'Discord Channels',
      el('span', { class: 'field-hint' }, `${usable.length} usable · ${unusable.length} unavailable`),
    ])
  );

  if (!channels.length) {
    card.append(
      el('div', { class: 'field-hint' }, 'Coach Intel cannot see any text channels in this server yet.')
    );
    return card;
  }

  for (const purpose of catalog.purposes) {
    const current = draft.get(purpose.id) || {
      purpose: purpose.id,
      discord_channel_id: null,
      sensitivity: purpose.defaultSensitivity,
      enabled: false,
    };

    const channelSelect = el(
      'select',
      {
        onchange: (e) => {
          const value = e.target.value || null;
          current.discord_channel_id = value;
          current.discord_channel_name = channels.find((c) => c.id === value)?.name || null;
          current.enabled = Boolean(value);
          draft.set(purpose.id, current);
          renderStatus();
        },
      },
      [
        el('option', { value: '', selected: current.discord_channel_id ? null : 'selected' }, 'Disabled'),
        ...channels.map((c) =>
          el(
            'option',
            {
              value: c.id,
              disabled: c.canPost ? null : 'disabled',
              selected: c.id === current.discord_channel_id ? 'selected' : null,
            },
            channelLabel(c)
          )
        ),
      ]
    );

    const sensitivitySelect = el(
      'select',
      {
        onchange: (e) => {
          current.sensitivity = e.target.value;
          draft.set(purpose.id, current);
        },
      },
      SENSITIVITY_ORDER.map((key) =>
        el('option', { value: key, selected: key === current.sensitivity ? 'selected' : null }, catalog.sensitivities[key])
      )
    );

    const statusNode = el('span', { class: 'field-hint' });
    function renderStatus() {
      const selected = channels.find((c) => c.id === current.discord_channel_id);
      if (!selected) {
        statusNode.className = 'field-hint';
        statusNode.textContent = 'Disabled';
        return;
      }
      if (selected.canPost) {
        statusNode.className = 'discord-check ok';
        statusNode.textContent = '✓ Connected';
      } else {
        statusNode.className = 'discord-check bad';
        statusNode.textContent = `✕ ${selected.missing.join(', ')}`;
      }
    }
    renderStatus();

    card.append(
      el('div', { class: 'discord-channel-row' }, [
        el('div', { class: 'discord-channel-label' }, [
          el('div', { style: 'font-weight:700;font-size:12.5px;' }, purpose.label),
          el('div', { class: 'field-hint' }, `e.g. ${purpose.example}`),
        ]),
        channelSelect,
        sensitivitySelect,
        statusNode,
      ])
    );
  }

  card.append(
    el('div', { class: 'field-hint', style: 'margin-top:10px;' },
      'Sensitivity controls which notifications may reach a channel. A Restricted event is never posted to a Public Team channel.')
  );

  card.append(
    el('div', { style: 'display:flex;justify-content:flex-end;margin-top:12px;' }, [
      el('button', {
        class: 'btn primary',
        onclick: async (e) => {
          const button = e.currentTarget;
          button.disabled = true;
          const result = await call(
            window.cci.discord.saveChannels({ mappings: [...draft.values()], actor })
          );
          button.disabled = false;
          if (!result) return;
          if (result.rejected?.length) {
            const first = result.rejected[0];
            toast(
              `${first.reason}${first.missing?.length ? `: ${first.missing.join(', ')}` : ''}. Other channels were saved.`,
              'warn'
            );
          } else {
            toast('Channel mapping saved.', 'ok');
          }
          onSaved?.();
        },
      }, 'Save Channels'),
    ])
  );

  return card;
}

/**
 * DISCORD NOTIFICATIONS — one toggle per domain event, defaulting to high-value
 * events only so a fresh connection does not flood a server.
 */
export function preferencesCard({ integration, catalog, actor, onSaved }) {
  const card = el('div', { class: 'card section' });
  const draft = { ...(integration.preferences || {}) };

  card.append(el('div', { class: 'section-title' }, 'Discord Notifications'));

  const enabledChannels = new Set(
    (integration.channels || []).filter((c) => c.enabled && c.discord_channel_id).map((c) => c.purpose)
  );

  for (const group of catalog.eventGroups) {
    card.append(
      el('div', { class: 'discord-group-label' }, group)
    );
    for (const event of catalog.events.filter((e) => e.group === group)) {
      const pref = draft[event.id] || { enabled: event.defaultEnabled, purpose: event.purpose };
      const purpose = catalog.purposes.find((p) => p.id === event.purpose);
      const routed = enabledChannels.has(event.purpose);

      const checkbox = el('input', {
        type: 'checkbox',
        checked: pref.enabled ? 'checked' : null,
        onchange: (e) => {
          draft[event.id] = { ...pref, enabled: e.target.checked };
        },
      });

      card.append(
        el('label', { class: 'discord-pref-row' }, [
          checkbox,
          el('div', { style: 'flex:1;' }, [
            el('div', { style: 'font-size:12.5px;' }, event.label),
            el('div', { class: 'field-hint' }, [
              `→ ${purpose?.label || event.purpose}`,
              routed ? null : el('span', { class: 'discord-check bad' }, '  · no channel configured'),
              // Only some events have a producer in Coach Intel today; saying so
              // beats a toggle that silently never fires.
              event.auto ? null : el('span', {}, '  · share manually for now'),
            ]),
          ]),
          el('span', { class: `discord-sensitivity ${event.sensitivity}` }, catalog.sensitivities[event.sensitivity]),
        ])
      );
    }
  }

  card.append(
    el('div', { style: 'display:flex;justify-content:flex-end;margin-top:12px;' }, [
      el('button', {
        class: 'btn primary',
        onclick: async (e) => {
          const button = e.currentTarget;
          button.disabled = true;
          const saved = await call(window.cci.discord.savePreferences({ preferences: draft, actor }));
          button.disabled = false;
          if (!saved) return;
          toast('Notification preferences saved.', 'ok');
          onSaved?.();
        },
      }, 'Save Notifications'),
    ])
  );

  return card;
}

/**
 * ROLE MAPPING — deliberately deferred. Coach Intel has no permission-role model
 * yet (a member's `role` is their in-game position), so there is nothing for a
 * Discord role to map onto. Shown so the gap is visible rather than silent.
 */
export function roleMappingCard({ roles }) {
  return el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, [
      'Role Mapping',
      el('span', { class: 'badge-soon' }, 'Not Available Yet'),
    ]),
    el('div', { class: 'field-hint', style: 'max-width:560px;line-height:1.5;' },
      'Coach Intel does not yet have staff permission roles — a player\'s role is their in-game position (IGL, AR, SMG, Sniper, Flex). ' +
      'Mapping Discord roles onto Coach Intel roles needs that model first, so it is intentionally not implemented. ' +
      'Coach Intel reads Discord roles and never modifies them.'),
    roles?.length
      ? el('div', { style: 'margin-top:12px;' }, [
          el('div', { class: 'field-hint', style: 'margin-bottom:6px;' }, `${roles.length} Discord role(s) visible to Coach Intel:`),
          el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' },
            roles.slice(0, 14).map((r) => el('span', { class: 'role-badge' }, r.name))),
        ])
      : null,
  ]);
}

/** Audit trail of Discord integration activity. */
export function auditCard({ entries }) {
  const card = el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Discord Activity Log'),
  ]);

  if (!entries?.length) {
    card.append(el('div', { class: 'field-hint' }, 'No Discord activity recorded yet.'));
    return card;
  }

  const table = el('table', {}, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, 'When'),
        el('th', {}, 'Action'),
        el('th', {}, 'Target'),
        el('th', {}, 'Actor'),
        el('th', {}, 'Result'),
      ]),
    ]),
    el(
      'tbody',
      {},
      entries.slice(0, 25).map((entry) =>
        el('tr', {}, [
          el('td', { class: 'field-hint' }, new Date(entry.timestamp).toLocaleString()),
          el('td', {}, String(entry.action || '').replace(/^discord\./, '').replace(/_/g, ' ')),
          el('td', { class: 'field-hint' }, entry.target || '—'),
          el('td', { class: 'field-hint' }, entry.actor || '—'),
          el('td', {}, [
            el('span', { class: `pill ${entry.result === 'SUCCESS' ? 'win' : 'loss'}` }, entry.result || '—'),
          ]),
        ])
      )
    ),
  ]);

  card.append(table);
  return card;
}
