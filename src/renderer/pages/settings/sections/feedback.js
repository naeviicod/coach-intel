import { el } from '../../../utils.js';
import { fillFeedbackForm, takeStashedFeedback } from '../../../components/feedback.js';

export async function render(panel, ctx) {
  const stashed = takeStashedFeedback() || {};
  const card = el('div', { class: 'card section' }, [
    el('div', { class: 'section-title' }, 'Feedback'),
    el('div', { class: 'field-hint', style: 'margin-bottom:16px;max-width:640px;line-height:1.5;' },
      'Bugs, ideas, and anything that feels off. Signed-in notes go to the Coach Intel team; otherwise this opens your email client.'),
  ]);
  const host = el('div', { class: 'feedback-settings' });
  card.append(host);
  panel.append(card);
  await fillFeedbackForm(host, {
    org: ctx.org,
    access: ctx.access,
    page: stashed.page || 'settings',
    teamId: stashed.teamId,
    teamName: stashed.teamName,
    prefill: stashed,
    heading: false,
    variant: 'page',
  });
}
