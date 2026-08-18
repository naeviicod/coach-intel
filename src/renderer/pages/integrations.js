import { el } from '../utils.js';
import { openModal, modalActions, toast, call } from '../components/modal.js';
import { channelsCard, preferencesCard, roleMappingCard, auditCard } from '../components/discordConfig.js';

// SETTINGS → INTEGRATIONS → DISCORD
//
// Coach Intel connects outbound to Discord: the organization runs its own Discord
// application, invites that bot to its server, and Coach Intel posts to approved
// channels. There is no Discord sign-in — Coach Intel is a local, single-user app.

const STATUS_TONE = {
  CONNECTED: 'ok',
  CONNECTING: 'warn',
  NOT_CONNECTED: 'idle',
  NEEDS_ATTENTION: 'warn',
  PERMISSION_ERROR: 'bad',
  DISCONNECTED: 'idle',
};

function relativeTime(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return 'never';
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export async function render(container, ctx) {
  container.append(
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('div', { class: 'page-title' }, 'Integrations'),
        el('div', { class: 'page-subtitle' }, 'Connect Coach Intel to the tools your staff already uses'),
      ]),
      el('button', { class: 'btn subtle', onclick: () => ctx.navigate('settings') }, '← Org Settings'),
    ])
  );

  const root = el('div', {});
  container.append(root);
  await renderDiscord(root, ctx);
}

function rerender(root, ctx) {
  root.innerHTML = '';
  return renderDiscord(root, ctx);
}

async function renderDiscord(root, ctx) {
  const state = await call(window.cci.discord.getState());
  if (!state) {
    root.append(el('div', { class: 'card section' }, el('div', { class: 'field-hint' }, 'Discord integration unavailable.')));
    return;
  }

  const org = await window.cci.getOrg();
  const actor = org?.coachName || 'Coach';

  root.append(headerCard(state, root, ctx, actor));

  if (!state.connected) {
    root.append(setupGuideCard());
    return;
  }

  const integration = state.integration;

  const [channels, roles, audit, health] = await Promise.all([
    call(window.cci.discord.listChannels(), { silent: true }),
    call(window.cci.discord.listRoles(), { silent: true }),
    call(window.cci.discord.audit({ limit: 25 }), { silent: true }),
    call(window.cci.discord.verify({ actor }), { silent: true }),
  ]);

  root.append(healthCard({ integration, health, state, root, ctx, actor }));

  if (channels) {
    root.append(
      channelsCard({
        integration,
        channels,
        catalog: state.catalog,
        actor,
        onSaved: () => rerender(root, ctx),
      })
    );
  }

  root.append(
    preferencesCard({
      integration,
      catalog: state.catalog,
      actor,
      onSaved: () => rerender(root, ctx),
    })
  );

  const hasChatChannel = (integration.channels || []).some((c) => c.purpose === 'team_chat' && c.enabled && c.discord_channel_id);
  if (hasChatChannel) root.append(teamChatCard(actor));

  root.append(roleMappingCard({ roles: roles || [] }));
  root.append(auditCard({ entries: audit || [] }));
}

// ---------- Team Chat ----------
//
// Polls the mapped "Team Chat" channel every 8s while this card is on screen.
// Not a live socket — a lightweight preview, matching what was scoped.

const CHAT_POLL_MS = 8000;

function chatMessageRow(m) {
  return el('div', { class: 'chat-msg' }, [
    m.avatar
      ? el('img', { class: 'chat-msg-avatar', src: m.avatar, alt: '' })
      : el('div', { class: 'chat-msg-avatar chat-msg-avatar-fallback' }, m.author.slice(0, 1).toUpperCase()),
    el('div', { class: 'chat-msg-body' }, [
      el('div', { class: 'chat-msg-head' }, [
        el('span', { class: 'chat-msg-author' }, m.author),
        el('span', { class: 'chat-msg-time' }, new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      ]),
      el('div', { class: 'chat-msg-content' }, m.content || '—'),
    ]),
  ]);
}

function teamChatCard(actor) {
  const card = el('div', { class: 'card section' });
  const title = el('div', { class: 'section-title' }, 'Team Chat');
  const list = el('div', { class: 'chat-list' });
  const status = el('div', { class: 'field-hint', style: 'padding:4px 0 8px;' }, 'Loading…');
  const input = el('input', { type: 'text', placeholder: 'Message the team…', maxlength: '2000' });
  const sendBtn = el('button', { class: 'btn primary sm edit-only' }, 'Send');

  card.append(title, status, list, el('div', { class: 'chat-compose edit-only' }, [input, sendBtn]));

  let timer = null;
  let sending = false;

  async function poll() {
    if (!document.body.contains(card)) {
      clearInterval(timer);
      return;
    }
    try {
      const result = await window.cci.discord.listMessages();
      title.textContent = `Team Chat — #${result.channelName}`;
      status.style.display = 'none';
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 20;
      list.innerHTML = '';
      if (!result.messages.length) {
        list.append(el('div', { class: 'field-hint', style: 'padding:10px 0;' }, 'No messages yet.'));
      } else {
        for (const m of result.messages) list.append(chatMessageRow(m));
      }
      if (atBottom) list.scrollTop = list.scrollHeight;
    } catch (err) {
      status.style.display = '';
      status.textContent = err?.message || 'Could not load Team Chat.';
    }
  }

  async function send() {
    const content = input.value.trim();
    if (!content || sending) return;
    sending = true;
    sendBtn.disabled = true;
    try {
      await window.cci.discord.sendChatMessage({ content, actor });
      input.value = '';
      await poll();
    } catch (err) {
      toast(err?.message || 'Could not send that message.', 'error');
    } finally {
      sending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }
  sendBtn.onclick = send;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
  });

  poll();
  timer = setInterval(poll, CHAT_POLL_MS);
  return card;
}

// ---------- Status header ----------

function headerCard(state, root, ctx, actor) {
  const status = state.status;
  const integration = state.integration;
  const card = el('div', { class: 'card section' });

  card.append(
    el('div', { class: 'section-title' }, [
      el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
        'Discord',
        el('span', { class: `discord-status ${STATUS_TONE[status] || 'idle'}` }, state.statusLabel || status),
      ]),
    ])
  );

  if (!state.connected) {
    card.append(
      el('div', { class: 'field-hint', style: 'max-width:560px;line-height:1.5;margin-bottom:14px;' },
        'Send Coach Intel notifications, Strats, Intel, and match reports into your team\'s Discord server. ' +
        'Coach Intel only posts to the channels you approve — the single exception is an optional "Team Chat" ' +
        'channel you can choose below, which Coach Intel previews inside the app.')
    );
    if (!state.encryptionAvailable) {
      card.append(
        el('div', { class: 'tip-card', style: 'margin-bottom:14px;border-left-color:var(--loss);' },
          'This Mac\'s keychain is unavailable, so Coach Intel cannot store a bot token securely. Connecting is disabled.')
      );
    }
    card.append(
      el('button', {
        class: 'btn primary',
        disabled: state.encryptionAvailable ? null : 'disabled',
        onclick: () => openConnectDialog(root, ctx, actor),
      }, 'Connect Discord Server')
    );
    return card;
  }

  card.append(
    el('div', { class: 'list-item-row' }, [
      el('div', {}, [
        el('div', { style: 'font-weight:700;font-size:12.5px;' }, integration.guild_name || 'Discord server'),
        el('div', { class: 'field-hint' },
          `Bot ${integration.bot_username || '—'} · connected by ${integration.connected_by || '—'} · ${relativeTime(integration.connected_at)}`),
      ]),
      el('div', { class: 'row-actions' }, [
        el('button', {
          class: 'btn',
          onclick: async (e) => {
            e.currentTarget.disabled = true;
            const result = await call(window.cci.discord.test({ actor }));
            e.currentTarget.disabled = false;
            if (result) toast(`Test successful — message delivered to #${result.channel}.`, 'ok');
          },
        }, 'Test Connection'),
        el('button', {
          class: 'btn subtle danger',
          onclick: () => openDisconnectDialog(root, ctx, actor, integration),
        }, 'Disconnect'),
      ]),
    ])
  );

  if (integration.last_error) {
    card.append(
      el('div', { class: 'tip-card', style: 'margin-top:12px;border-left-color:var(--loss);' }, integration.last_error)
    );
  }

  return card;
}

// ---------- Health panel ----------

function healthRow(label, ok, detail) {
  const mark = ok === true ? '✓' : ok === false ? '✕' : '⚠';
  const tone = ok === true ? 'ok' : ok === false ? 'bad' : 'warn';
  return el('div', { class: 'discord-health-row' }, [
    el('div', { class: 'discord-health-label' }, label),
    el('span', { class: `discord-check ${tone}` }, mark),
    el('div', { class: 'field-hint' }, detail || ''),
  ]);
}

function healthCard({ integration, health, state, root, ctx, actor }) {
  const card = el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, [
      'Integration Health',
      el('button', {
        class: 'btn subtle',
        onclick: async () => {
          await call(window.cci.discord.verify({ actor }));
          rerender(root, ctx);
        },
      }, 'Re-check'),
    ]),
  ]);

  const enabledChannels = (integration.channels || []).filter((c) => c.enabled && c.discord_channel_id);
  const enabledEvents = Object.values(integration.preferences || {}).filter((p) => p.enabled).length;

  card.append(healthRow('Bot Token', state.hasCredential, state.hasCredential ? 'Stored in the macOS keychain' : 'Missing'));
  card.append(healthRow('Server', health?.guild?.ok ?? null, health?.guild?.error || health?.guild?.name || integration.guild_name));
  card.append(healthRow('Bot', health?.bot?.ok ?? null, health?.bot?.error || `${integration.bot_username || 'Installed'}`));
  card.append(
    healthRow(
      'Notifications',
      enabledEvents > 0 && enabledChannels.length > 0,
      enabledChannels.length
        ? `${enabledEvents} event(s) active across ${enabledChannels.length} channel(s)`
        : 'No channels configured yet'
    )
  );

  for (const channel of health?.channels || []) {
    card.append(healthRow(channel.label, channel.ok, channel.error || `#${channel.channel_name}`));
  }

  card.append(healthRow('Role Mapping', null, 'Not available — Coach Intel has no staff permission roles yet'));
  card.append(
    el('div', { class: 'discord-health-row' }, [
      el('div', { class: 'discord-health-label' }, 'Last Verified'),
      el('span', {}, ''),
      el('div', { class: 'field-hint' }, relativeTime(health?.verified_at || integration.last_verified_at)),
    ])
  );

  return card;
}

// ---------- Setup guide ----------

function setupGuideCard() {
  const step = (n, title, body) =>
    el('div', { class: 'discord-step' }, [
      el('div', { class: 'discord-step-num' }, String(n)),
      el('div', {}, [
        el('div', { style: 'font-weight:700;font-size:12.5px;margin-bottom:2px;' }, title),
        el('div', { class: 'field-hint', style: 'line-height:1.5;' }, body),
      ]),
    ]);

  return el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'What You Need First'),
    el('div', { class: 'field-hint', style: 'margin-bottom:14px;max-width:600px;line-height:1.5;' },
      'Coach Intel runs entirely on this Mac, so your organization supplies its own Discord bot. ' +
      'That way the credential belongs to you and never ships inside the app.'),
    step(1, 'Create a Discord application',
      'Open the Discord Developer Portal, create an application, then add a Bot to it.'),
    step(2, 'Copy the bot token',
      'On the Bot page, reset and copy the token. Treat it like a password — Coach Intel stores it encrypted in the macOS keychain and never displays it again.'),
    step(3, 'Invite the bot to your server',
      'Paste the token into Coach Intel and it will generate an invite link requesting only View Channel, Send Messages, and Embed Links. Administrator is never requested.'),
    step(4, 'Choose channels',
      'Pick which Discord channel receives Strats, Intel, match reports, VOD review, and alerts — and set how sensitive each channel is.'),
    el('div', { style: 'margin-top:14px;' }, [
      el('button', {
        class: 'btn',
        onclick: () => window.cci.openExternal('https://discord.com/developers/applications'),
      }, 'Open Discord Developer Portal ↗'),
    ]),
  ]);
}

// ---------- Connect dialog ----------

function openConnectDialog(root, ctx, actor) {
  const body = el('div', {});
  const overlay = openModal(body, { width: '480px' });

  function step1() {
    body.innerHTML = '';
    const input = el('input', {
      type: 'password',
      id: 'discord-token',
      placeholder: 'Paste your bot token',
      autocomplete: 'off',
    });
    const error = el('div', { class: 'field-hint', style: 'color:var(--loss);' });

    body.append(
      el('h3', {}, 'Connect Discord Server'),
      el('div', { class: 'field-hint', style: 'margin-bottom:14px;line-height:1.5;' },
        'Paste the bot token from your Discord application. It is encrypted with the macOS keychain and never leaves this Mac except to talk to Discord.'),
      el('div', { class: 'field' }, [el('label', {}, 'Bot Token'), input, error])
    );

    const continueBtn = el('button', {
      class: 'btn primary',
      onclick: async () => {
        const token = input.value.trim();
        if (!token) {
          error.textContent = 'Enter the bot token to continue.';
          return;
        }
        continueBtn.disabled = true;
        continueBtn.textContent = 'Checking…';
        const result = await window.cci.discord.beginConnect({ botToken: token });
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continue';
        if (!result.ok) {
          error.textContent = result.message;
          return;
        }
        input.value = '';
        step2(result.data);
      },
    }, 'Continue');

    body.append(
      modalActions([
        el('button', {
          class: 'btn subtle',
          onclick: async () => {
            await window.cci.discord.cancelConnect();
            overlay.remove();
          },
        }, 'Cancel'),
        continueBtn,
      ])
    );
    input.focus();
  }

  function step2({ bot, guilds }) {
    body.innerHTML = '';
    body.append(
      el('h3', {}, 'Choose a Server'),
      el('div', { class: 'field-hint', style: 'margin-bottom:14px;' }, `Signed in as bot ${bot.username}.`)
    );

    if (!guilds.length) {
      body.append(
        el('div', { class: 'tip-card', style: 'margin-bottom:14px;' },
          'This bot has not been invited to any server yet. Invite it, then come back and continue.'),
        el('button', {
          class: 'btn',
          style: 'width:100%;margin-bottom:8px;',
          onclick: () => window.cci.openExternal(inviteUrl(bot.id)),
        }, 'Invite Coach Intel Bot ↗')
      );
      body.append(
        modalActions([
          el('button', {
            class: 'btn subtle',
            onclick: async () => {
              await window.cci.discord.cancelConnect();
              overlay.remove();
            },
          }, 'Cancel'),
          el('button', { class: 'btn primary', onclick: () => step1() }, 'Start Over'),
        ])
      );
      return;
    }

    let selected = guilds[0].id;
    const list = el('div', { style: 'max-height:240px;overflow-y:auto;margin-bottom:6px;' });
    for (const guild of guilds) {
      const radio = el('input', {
        type: 'radio',
        name: 'discord-guild',
        value: guild.id,
        checked: guild.id === selected ? 'checked' : null,
        onchange: () => {
          selected = guild.id;
        },
      });
      list.append(
        el('label', { class: 'discord-pref-row' }, [
          radio,
          el('div', { style: 'flex:1;font-size:12.5px;font-weight:600;' }, guild.name),
        ])
      );
    }
    body.append(list);
    body.append(
      el('div', { class: 'field-hint', style: 'margin-bottom:6px;' },
        'Only servers this bot has been invited to appear here, so Discord\'s own permissions decide what you can connect.')
    );

    body.append(
      modalActions([
        el('button', {
          class: 'btn subtle',
          onclick: async () => {
            await window.cci.discord.cancelConnect();
            overlay.remove();
          },
        }, 'Cancel'),
        el('button', {
          class: 'btn primary',
          onclick: async (e) => {
            e.currentTarget.disabled = true;
            const result = await call(window.cci.discord.completeConnect({ guildId: selected, actor }));
            if (!result) {
              e.currentTarget.disabled = false;
              return;
            }
            overlay.remove();
            toast(`Connected to ${result.guild_name}. Choose channels next.`, 'ok');
            rerender(root, ctx);
          },
        }, 'Connect'),
      ])
    );
  }

  step1();
}

function inviteUrl(applicationId) {
  const params = new URLSearchParams({
    client_id: String(applicationId),
    scope: 'bot',
    // View Channel + Send Messages + Embed Links only.
    permissions: '19456',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// ---------- Disconnect ----------

function openDisconnectDialog(root, ctx, actor, integration) {
  const body = el('div', {}, [
    el('h3', {}, 'Disconnect Discord Server?'),
    el('div', { class: 'field-hint', style: 'line-height:1.6;margin-bottom:12px;' },
      `This stops Discord notifications and sharing for ${integration.guild_name || 'this server'}.`),
    el('div', { class: 'tip-card', style: 'margin-bottom:4px;' },
      'Coach Intel teams, players, Strats, Intel, matches and reports will remain unchanged. ' +
      'The stored bot token and all channel mappings are deleted.'),
  ]);
  const overlay = openModal(body);
  body.append(
    modalActions([
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn danger',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          const result = await call(window.cci.discord.disconnect({ actor }));
          overlay.remove();
          if (result) toast('Discord disconnected. Coach Intel data untouched.', 'ok');
          rerender(root, ctx);
        },
      }, 'Disconnect'),
    ])
  );
}
