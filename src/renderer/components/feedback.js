import { el, icon } from '../utils.js';
import { openModal } from './modal.js';
import { chipIdentity } from '../lib/profile.js';
import { FEEDBACK_CATEGORIES, feedbackCategoryLabel, validateFeedback } from '../lib/feedback.js';

// FEEDBACK
//
// Lives in Settings. Crash-card "Report this issue" navigates there with
// optional prefill (or opens a modal if Settings itself is the page that
// crashed). Supabase is the primary path (a durable, RLS-scoped row); mailto
// is the fallback when there's no session to write with, or the save itself
// fails — feedback should never just disappear because the table isn't
// migrated yet or the app is offline.

let stashed = null;

export function stashFeedback(prefill) {
  stashed = prefill || null;
}

export function takeStashedFeedback() {
  const next = stashed;
  stashed = null;
  return next;
}

function platformLabel() {
  const p = (navigator.platform || navigator.userAgent || '').toString();
  if (/Mac/i.test(p)) return 'macOS';
  if (/Win/i.test(p)) return 'Windows';
  if (/Linux/i.test(p)) return 'Linux';
  return p || 'Unknown';
}

function successBody(message, onClose, { variant }) {
  const page = variant === 'page';
  return el('div', { class: `fb-success${page ? ' in-page' : ''}` }, [
    el('div', { class: 'fb-success-mark', html: icon('check', 18) }),
    el('div', { class: 'fb-success-copy' }, [
      el('div', { class: 'fb-success-title' }, 'Sent'),
      el('div', { class: 'fb-success-body' }, message),
    ]),
    el('button', { class: 'btn primary', onclick: onClose }, page ? 'Send another' : 'Close'),
  ]);
}

function categoryChips(initial) {
  let value = initial;
  const group = el(
    'div',
    { class: 'fb-cats', role: 'radiogroup', 'aria-labelledby': 'fb-category-label' },
    FEEDBACK_CATEGORIES.map((c) => {
      const on = c.value === value;
      return el(
        'button',
        {
          type: 'button',
          class: `fb-cat${on ? ' active' : ''}`,
          role: 'radio',
          'aria-checked': on ? 'true' : 'false',
          'data-value': c.value,
          onclick: () => {
            value = c.value;
            for (const node of group.querySelectorAll('.fb-cat')) {
              const active = node.dataset.value === value;
              node.classList.toggle('active', active);
              node.setAttribute('aria-checked', active ? 'true' : 'false');
            }
          },
        },
        c.label
      );
    })
  );
  return { group, get: () => value };
}

export async function fillFeedbackForm(body, {
  org,
  access,
  page,
  teamId,
  teamName,
  prefill,
  heading = true,
  variant = 'modal',
  onDone,
} = {}) {
  const [authState, appVersion] = await Promise.all([
    window.cci.auth.getState().catch(() => null),
    window.cci.getAppVersion().catch(() => null),
  ]);
  const signedIn = Boolean(authState?.configured && authState.session);
  const sessionEmail = authState?.session?.user?.email || '';
  const identity = chipIdentity(org, access);
  const cats = categoryChips(prefill?.category || 'bug');
  const subjectInput = el('input', {
    type: 'text',
    id: 'fb-subject',
    value: prefill?.subject || '',
    placeholder: 'Short summary',
    autocomplete: 'off',
  });
  const descriptionInput = el('textarea', {
    id: 'fb-description',
    rows: variant === 'page' ? 8 : 5,
    placeholder: 'What happened, what you expected, and any steps to reproduce.',
    value: prefill?.description || '',
  });
  const emailInput = el('input', {
    type: 'email',
    id: 'fb-email',
    value: sessionEmail,
    placeholder: 'you@example.com',
    autocomplete: 'email',
  });
  const errorLine = el('div', { class: 'fb-error', hidden: 'hidden' });
  const contextBits = [
    ['Page', page],
    ['App', appVersion ? `v${appVersion}` : null],
    ['OS', platformLabel()],
    teamName ? ['Team', teamName] : null,
  ].filter((row) => row && row[1]);

  function renderForm() {
    body.replaceChildren();
    body.classList.add('fb-form');
    body.classList.toggle('fb-form-page', variant === 'page');

    if (heading) {
      body.append(
        el('div', { class: 'fb-head' }, [
          el('div', { class: 'fb-head-mark', html: icon('feedback', 16) }),
          el('div', {}, [
            el('h3', {}, 'Send Feedback'),
            el('div', { class: 'fb-head-sub' }, 'Bugs, ideas, and anything that feels off.'),
          ]),
        ])
      );
    }

    body.append(
      el('div', { class: 'field' }, [
        el('label', { id: 'fb-category-label' }, 'Category'),
        cats.group,
      ]),
      el('div', { class: 'fb-split' }, [
        el('div', { class: 'field' }, [el('label', { for: 'fb-subject' }, 'Subject'), subjectInput]),
        el('div', { class: 'field' }, [el('label', { for: 'fb-email' }, 'Contact email (optional)'), emailInput]),
      ]),
      el('div', { class: 'field fb-desc' }, [el('label', { for: 'fb-description' }, 'Description'), descriptionInput]),
      el('div', { class: 'fb-meta' }, contextBits.map(([k, v]) =>
        el('span', { class: 'fb-meta-chip' }, [el('span', { class: 'fb-meta-k' }, k), v])
      )),
      errorLine
    );

    const cancelBtn = onDone && variant !== 'page'
      ? el('button', { class: 'btn subtle', onclick: () => onDone() }, 'Cancel')
      : null;
    const emailBtn = el('button', { class: 'btn subtle', onclick: () => submit({ viaEmail: true }) }, 'Open in Email Instead');
    const sendBtn = el('button', { class: 'btn primary', onclick: () => submit({ viaEmail: false }) }, 'Send Feedback');
    body.append(el('div', { class: variant === 'page' ? 'settings-actions' : 'modal-actions' }, [cancelBtn, emailBtn, sendBtn].filter(Boolean)));

    function setBusy(busy) {
      if (cancelBtn) cancelBtn.disabled = busy;
      emailBtn.disabled = busy;
      sendBtn.disabled = busy;
      sendBtn.textContent = busy ? 'Sending…' : 'Send Feedback';
    }

    function showError(message, field) {
      errorLine.hidden = false;
      errorLine.textContent = message;
      if (field === 'description') descriptionInput.focus();
      else if (field === 'subject') subjectInput.focus();
    }

    async function submit({ viaEmail }) {
      const result = validateFeedback({
        category: cats.get(),
        subject: subjectInput.value,
        description: descriptionInput.value,
        contactEmail: emailInput.value,
        page,
        appVersion,
        platform: platformLabel(),
        teamId,
      });
      errorLine.hidden = true;
      if (!result.ok) {
        showError(result.error, result.field);
        return;
      }

      setBusy(true);
      const entry = result.entry;
      const mailtoEntry = {
        ...entry,
        categoryLabel: feedbackCategoryLabel(entry.category),
        userLabel: identity?.name || 'Coach',
        teamLabel: teamName || '',
        orgLabel: org?.name || '',
        timestamp: new Date().toISOString(),
      };

      if (!viaEmail && signedIn) {
        const saved = await window.cci.submitFeedback(entry).catch((err) => ({ ok: false, error: err?.message }));
        if (saved?.ok) {
          body.replaceChildren(successBody('Thanks — the Coach Intel team has your note.', () => {
            if (onDone && variant !== 'page') onDone();
            else renderForm();
          }, { variant }));
          return;
        }
      }

      const mailed = await window.cci.sendFeedbackEmail(mailtoEntry).catch((err) => ({ ok: false, error: err?.message }));
      if (mailed?.ok) {
        body.replaceChildren(successBody('Opened in your email client — send it from there to reach the Coach Intel team.', () => {
          if (onDone && variant !== 'page') onDone();
          else renderForm();
        }, { variant }));
        return;
      }

      setBusy(false);
      showError(mailed?.error || 'Could not send feedback. Your entry is still here — try again.');
    }
  }

  renderForm();
}

export async function openFeedbackModal(opts = {}) {
  const body = el('div', {});
  const overlay = openModal(body, { width: '560px' });
  overlay.querySelector('.modal')?.classList.add('feedback-modal');
  await fillFeedbackForm(body, { ...opts, variant: 'modal', heading: true, onDone: () => overlay.remove() });
}
