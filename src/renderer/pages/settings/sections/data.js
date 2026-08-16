import { el } from '../../../utils.js';
import { openModal } from '../../../components/modal.js';

export async function render(panel) {
  panel.append(
    el('div', { class: 'card section' }, [
      el('div', { class: 'section-title' }, 'Storage'),
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { class: 'settings-row-title' }, 'On-device only'),
          el(
            'div',
            { class: 'field-hint', style: 'max-width:560px;line-height:1.5;' },
            'Every team, roster, match, note and strat is stored as plain JSON on this Mac. Nothing is uploaded, and the app works with the network off.'
          ),
        ]),
        el('span', { class: 'pill win' }, 'Local'),
      ]),
      el('div', { class: 'list-item-row' }, [
        el('div', {}, [
          el('div', { class: 'settings-row-title' }, 'Reference data'),
          el(
            'div',
            { class: 'field-hint', style: 'max-width:560px;line-height:1.5;' },
            'The CDL ruleset and meta-knowledge files ship with the app. They are never erased by the actions below.'
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
            'Permanently erases the organization, every team, roster, match, veto and strat. The CDL ruleset and meta-knowledge reference data are kept. This cannot be undone.'
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
