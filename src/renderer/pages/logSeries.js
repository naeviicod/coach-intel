import { el } from '../utils.js';
import { openModal, modalActions, toast } from '../components/modal.js';
import { emptyBo5, scorePlaceholder, seriesMatchRecords } from '../lib/series.js';

const MODE_SHORT = {
  Hardpoint: 'HP',
  'Search & Destroy': 'SnD',
  Overload: 'OL',
};

export function openLogSeries({ teams, ruleset, onSaved }) {
  const maps = (ruleset?.maps || []).filter((m) => m.active !== false).map((m) => m.name);
  const modes = ruleset?.modes || ['Hardpoint', 'Search & Destroy', 'Overload'];
  const today = new Date().toISOString().slice(0, 10);
  const body = el('div', {});
  const overlay = openModal(body, { width: '740px' });
  const games = emptyBo5(modes);

  body.append(el('h3', {}, 'Log series · Best of 5'));
  const teamSel = select(teams.map((t) => [t.id, t.name]));
  const opponent = el('input', { required: true, placeholder: 'Opponent' });
  const date = el('input', { type: 'date', value: today });
  body.append(
    el('div', { class: 'inline-fields' }, [
      field('Team', teamSel),
      field('Opponent', opponent),
      field('Date', date),
    ])
  );

  const rows = el('div', { class: 'bo5-maps' });
  const controls = games.map((slot) => {
    const mapSel = select([['', '—'], ...maps.map((m) => [m, m])]);
    const resultSel = select([['', '—'], ['Win', 'Win'], ['Loss', 'Loss']]);
    const score = el('input', { placeholder: scorePlaceholder(slot.mode) });
    rows.append(
      el('div', { class: 'bo5-map' }, [
        el('div', { class: 'bo5-map-label' }, [el('span', {}, `G${slot.index + 1}`), el('strong', {}, MODE_SHORT[slot.mode] || slot.mode)]),
        field('Map', mapSel),
        field('Result', resultSel),
        field('Points', score),
      ])
    );
    return { slot, mapSel, resultSel, score };
  });
  body.append(rows);
  body.append(el('div', { class: 'field-hint', style: 'margin-top:8px;' }, 'HP → SnD → OL → HP → SnD. Drop scoreboards to fill player stats.'));

  body.append(
    modalActions([
      el('button', { class: 'btn subtle', type: 'button', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', {
        class: 'btn primary',
        type: 'button',
        onclick: async () => {
          const mapsState = rowsToMaps(controls);
          const records = seriesMatchRecords({
            teamId: teamSel.value,
            opponent: opponent.value.trim(),
            date: date.value,
            seriesId: `series-${Date.now().toString(36)}`,
            maps: mapsState,
          });
          if (!records.length) {
            toast('Fill at least one map — map, result, or score.', 'error');
            return;
          }
          if (!opponent.value.trim()) {
            toast('Opponent is required.', 'error');
            return;
          }
          for (const rec of records) {
            await window.cci.saveMatch(rec.teamId, rec.payload);
          }
          toast('Series saved', 'ok');
          overlay.remove();
          onSaved?.();
        },
      }, 'Save series'),
    ])
  );
}

function rowsToMaps(controls) {
  return controls.map(({ slot, mapSel, resultSel, score }) => ({
    ...slot,
    map: mapSel.value,
    result: resultSel.value,
    score: score.value.trim(),
  }));
}

function field(label, control) {
  return el('div', { class: 'field' }, [el('label', {}, label), control]);
}

function select(options) {
  return el(
    'select',
    {},
    options.map(([value, label]) => el('option', { value }, label))
  );
}
