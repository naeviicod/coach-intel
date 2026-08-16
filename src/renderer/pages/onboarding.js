import { el } from '../utils.js';
import { asset } from '../lib/assets.js';

export async function render(container, ctx) {
  const state = { step: 1, org: { name: '', tag: '', logo: null }, team: { name: '', tag: '' } };
  draw(container, ctx, state);
}

function draw(container, ctx, state) {
  container.innerHTML = '';
  container.append(
    el('div', { class: 'onboarding-screen' }, [
      el('div', { class: 'onboarding-brand-wrap' }, [
        el('img', { class: 'onboarding-brand brand-tint', src: asset('full-logo.png'), alt: 'Coach Intel' }),
      ]),
      state.step === 1 ? orgStep(container, ctx, state) : teamStep(container, ctx, state),
    ])
  );
}

function orgStep(container, ctx, state) {
  const card = el('div', { class: 'onboarding-card' }, [
    el('div', { class: 'onboarding-step-label' }, 'STEP 1 OF 2 — ORGANIZATION'),
    el('div', { class: 'onboarding-title' }, 'Set up your organization'),
    el('div', { class: 'onboarding-sub' }, 'This is the workspace that will hold your teams, rosters, and match data.'),
    el('div', { class: 'field' }, [
      el('label', {}, 'Organization Name'),
      el('input', {
        type: 'text',
        id: 'ob-org-name',
        value: state.org.name,
        placeholder: 'e.g. Naevii',
        oninput: (e) => { state.org.name = e.target.value; },
      }),
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Tag / Abbreviation (optional)'),
      el('input', {
        type: 'text',
        id: 'ob-org-tag',
        value: state.org.tag,
        placeholder: 'e.g. NAE',
        oninput: (e) => { state.org.tag = e.target.value; },
      }),
    ]),
    logoField('ob-org-logo', state.org, () => draw(container, ctx, state)),
  ]);

  const continueBtn = el(
    'button',
    {
      class: 'btn primary onboarding-continue',
      onclick: () => {
        const name = card.querySelector('#ob-org-name').value.trim();
        if (!name) return;
        state.org.name = name;
        state.org.tag = card.querySelector('#ob-org-tag').value.trim();
        state.step = 2;
        draw(container, ctx, state);
      },
    },
    'Continue'
  );
  card.append(continueBtn);
  return card;
}

function teamStep(container, ctx, state) {
  const card = el('div', { class: 'onboarding-card' }, [
    el('div', { class: 'onboarding-step-label' }, 'STEP 2 OF 2 — FIRST TEAM'),
    el('div', { class: 'onboarding-title' }, 'Create your first team'),
    el('div', { class: 'onboarding-sub' }, `Every roster, match, and Intel signal lives under a team inside ${state.org.name}.`),
    el('div', { class: 'field' }, [
      el('label', {}, 'Team Name'),
      el('input', {
        type: 'text',
        id: 'ob-team-name',
        value: state.team.name,
        placeholder: 'e.g. Team Naevii',
        oninput: (e) => { state.team.name = e.target.value; },
      }),
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Tag / Abbreviation (optional)'),
      el('input', {
        type: 'text',
        id: 'ob-team-tag',
        value: state.team.tag,
        placeholder: 'e.g. NAE',
        oninput: (e) => { state.team.tag = e.target.value; },
      }),
    ]),
  ]);

  const actions = el('div', { style: 'display:flex;gap:8px;' }, [
    el(
      'button',
      {
        class: 'btn',
        onclick: () => {
          state.step = 1;
          draw(container, ctx, state);
        },
      },
      'Back'
    ),
    el(
      'button',
      {
        class: 'btn primary onboarding-continue',
        style: 'flex:1;',
        onclick: async (e) => {
          const name = card.querySelector('#ob-team-name').value.trim();
          if (!name) return;
          e.target.disabled = true;
          e.target.textContent = 'Creating…';
          const tag = card.querySelector('#ob-team-tag').value.trim();
          await window.cci.saveOrg({ name: state.org.name, tag: state.org.tag || null, logo: state.org.logo });
          await window.cci.saveTeam({ name, tag: tag || null });
          await ctx.onComplete();
        },
      },
      'Create Team & Enter Command Center'
    ),
  ]);
  card.append(actions);
  return card;
}

function logoField(inputId, target, onChange) {
  const preview = el('div', { class: 'onboarding-logo-preview' }, target.logo ? '' : '—');
  if (target.logo && window.cci?.dataUrlForPath) {
    window.cci.dataUrlForPath(target.logo).then((url) => {
      if (!url || !preview.isConnected) return;
      preview.replaceChildren(el('img', { src: url, alt: '' }));
    });
  }

  return el('div', { class: 'field' }, [
    el('label', {}, 'Organization Logo (optional)'),
    el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
      preview,
      el(
        'button',
        {
          class: 'btn',
          id: inputId,
          onclick: async () => {
            const src = await window.cci.pickImage();
            if (!src) return;
            const ext = src.split('.').pop();
            const rel = await window.cci.copyImage(src, `org/logos/org-logo.${ext}`);
            target.logo = rel;
            onChange();
          },
        },
        'Upload Logo'
      ),
    ]),
  ]);
}
