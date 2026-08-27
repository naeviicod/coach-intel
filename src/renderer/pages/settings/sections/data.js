import { el } from '../../../utils.js';
import { openModal } from '../../../components/modal.js';

export async function render(panel, ctx) {
  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Storage'),
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { class: 'settings-row-title' }, ctx?.online ? 'Org cloud + this Mac' : 'Org cloud, cached on this Mac'),
          el(
            'div',
            { class: 'field-hint', style: 'max-width:560px;line-height:1.5;' },
            ctx?.online
              ? 'Teams, roster, matches, notes and strats live in the org database. This Mac keeps a local JSON copy so the app still works if the network drops.'
              : 'Teams, roster, matches, notes and strats sync to the org database when you sign in. This Mac keeps a local JSON copy in the meantime.'
          ),
        ]),
        el('span', { class: 'pill win' }, ctx?.online ? 'Cloud' : 'Local'),
      ]),
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { class: 'settings-row-title' }, 'Reference data'),
          el(
            'div',
            { class: 'field-hint', style: 'max-width:560px;line-height:1.5;' },
            'The CDL ruleset ships with the app. It is never erased by the actions below.'
          ),
        ]),
        el('span', { class: 'role-badge' }, 'Bundled'),
      ]),
    ])
  );

  panel.append(
    el('div', { class: 'card section danger-zone' }, [
      el('div', { class: 'section-title' }, 'Danger Zone'),
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { class: 'settings-row-title' }, 'Delete All Data'),
          el(
            'div',
            { class: 'field-hint', style: 'max-width:560px;line-height:1.5;' },
            'Permanently erases the organization, every team, roster, match, veto and strat. The CDL ruleset is kept. This cannot be undone.'
          ),
        ]),
        el('button', { class: 'btn danger', onclick: openDeleteAllModal }, 'Delete All Data'),
      ]),
    ])
  );
}

function openDeleteAllModal() {
  const body = el('div', {}, [
    el('h3', {}, 'Delete all data?'),
    el('div', { class: 'field-hint', style: 'margin-bottom:14px;' }, 'This permanently erases your organization, teams, rosters, matches, and strats. Type DELETE to confirm.'),
    el('div', { class: 'field' }, [el('input', { type: 'text', id: 'confirm-delete-input', placeholder: 'Type Delete' })]),
  ]);
  const overlay = openModal(body);
  const confirmBtn = el(
    'button',
    {
      class: 'btn danger',
      disabled: 'disabled',
      onclick: async () => {
        await window.cci.deleteAllData();
        overlay.remove();
        window.location.hash = '#/dashboard';
        window.location.reload();
      },
    },
    'Delete Everything'
  );
  const input = body.querySelector('#confirm-delete-input');
  input.addEventListener('input', () => {
    confirmBtn.disabled = input.value.trim().toLowerCase() !== 'delete';
  });
  body.append(
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
      confirmBtn,
    ])
  );
}
