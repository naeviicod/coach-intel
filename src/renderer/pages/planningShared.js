// Shared building blocks for the planning & prep pages (Calendar, Scrim Hub,
// VOD Library, Veto Lab, Scouting, Reports, Rankings). Keeps their headers,
// forms and confirmations consistent with the rest of the app.

import { el } from '../utils.js';
import { openModal, modalActions, toast } from '../components/modal.js';

export { toast };

export function pageHeader(title, subtitle, right = null) {
  return el('div', { class: 'page-header' }, [
    el('div', {}, [
      el('div', { class: 'page-title' }, title),
      subtitle ? el('div', { class: 'page-subtitle' }, subtitle) : null,
    ]),
    right,
  ]);
}

// The team switcher used by team-scoped pages. Mirrors the Maps & Modes header.
export function teamSelect(teams, activeId, onChange) {
  if (teams.length < 2) return null;
  return el(
    'select',
    { 'aria-label': 'Team', onchange: (e) => onChange(e.target.value) },
    teams.map((t) => el('option', { value: t.id, selected: t.id === activeId ? 'selected' : null }, t.name))
  );
}

export function emptyState(title, body, action = null) {
  return el('div', { class: 'card empty-state' }, [
    el('div', { class: 'title' }, title),
    el('div', { style: 'max-width:440px;margin:2px auto 0;line-height:1.6;' }, body),
    action ? el('div', { style: 'margin-top:14px;' }, action) : null,
  ]);
}

function control(field, value) {
  const attrs = { id: `pf-${field.key}`, name: field.key };
  if (field.placeholder) attrs.placeholder = field.placeholder;
  if (field.type === 'textarea') {
    return el('textarea', { ...attrs, rows: field.rows || 4 }, value != null ? String(value) : '');
  }
  if (field.type === 'select') {
    return el(
      'select',
      attrs,
      (field.options || []).map((opt) => {
        const [v, label] = Array.isArray(opt) ? opt : [opt, opt];
        return el('option', { value: v, selected: String(value) === String(v) ? 'selected' : null }, label);
      })
    );
  }
  const type = ['date', 'time', 'number'].includes(field.type) ? field.type : 'text';
  return el('input', { ...attrs, type, value: value != null ? String(value) : '' });
}

function fieldBlock(field, controlNode) {
  return el('div', { class: 'field', style: 'margin-bottom:0;' }, [
    field.label ? el('label', { for: `pf-${field.key}` }, field.label) : null,
    controlNode,
    field.hint ? el('div', { class: 'field-hint' }, field.hint) : null,
  ]);
}

/**
 * A modal form. `fields` is a flat list of field specs, or nested arrays to lay
 * a run of fields out side by side (e.g. [ ['date','time'] ]).
 * Resolves the collected values through `onSubmit(values)`.
 */
export function openForm({ title, submitLabel = 'Save', fields, values = {}, width = '460px', onSubmit }) {
  const body = el('div', {}, [el('h3', {}, title)]);
  const controls = {};

  const renderField = (field) => {
    const node = control(field, values[field.key] !== undefined ? values[field.key] : field.default);
    controls[field.key] = { field, node };
    return fieldBlock(field, node);
  };

  for (const entry of fields) {
    if (Array.isArray(entry)) {
      body.append(el('div', { class: 'inline-fields', style: 'margin-bottom:14px;' }, entry.map(renderField)));
    } else {
      body.append(el('div', { style: 'margin-bottom:14px;' }, [renderField(entry)]));
    }
  }

  const overlay = openModal(body, { width });

  const submit = async (button) => {
    const out = {};
    for (const [key, { field, node }] of Object.entries(controls)) {
      let value = node.value;
      if (typeof value === 'string') value = value.trim();
      if (field.type === 'number') value = value === '' ? null : Number(value);
      out[key] = value;
    }
    for (const { field } of Object.values(controls)) {
      if (field.required && !out[field.key]) {
        toast(`${field.label || field.key} is required`, 'error');
        return;
      }
    }
    button.disabled = true;
    try {
      await onSubmit(out);
      overlay.remove();
    } catch (err) {
      button.disabled = false;
      toast(err?.message || 'Could not save', 'error');
    }
  };

  const saveBtn = el('button', { class: 'btn primary', onclick: (e) => submit(e.currentTarget) }, submitLabel);
  body.append(
    modalActions([el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'), saveBtn])
  );
  return overlay;
}

// Small destructive-action confirm. Resolves nothing; runs onConfirm on accept.
export function confirmModal({ title, body, confirmLabel = 'Delete', danger = true, onConfirm }) {
  const overlay = openModal(
    el('div', {}, [
      el('h3', {}, title),
      el('div', { style: 'color:var(--text-dim);font-size:12.5px;line-height:1.55;' }, body),
      modalActions([]),
    ])
  );
  const confirm = async (button) => {
    button.disabled = true;
    try {
      await onConfirm();
      overlay.remove();
    } catch (err) {
      button.disabled = false;
      toast(err?.message || 'Something went wrong', 'error');
    }
  };
  overlay.querySelector('.modal-actions').append(
    el('button', { class: 'btn subtle', onclick: () => overlay.remove() }, 'Cancel'),
    el('button', { class: `btn${danger ? ' danger' : ' primary'}`, onclick: (e) => confirm(e.currentTarget) }, confirmLabel)
  );
  return overlay;
}
