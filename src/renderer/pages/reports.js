import { el, icon } from '../utils.js';
import { pageHeader, emptyState, toast } from './planningShared.js';
import { buildTeamReport, buildOpponentReport } from '../lib/report.js';

// Org-wide by default. The Team Hub embeds this with `ctx.teamId` set and
// `ctx.header === false`, which locks the report to that team and drops the
// page heading and team picker the hub already provides.
export async function render(container, ctx) {
  const [teams, opponents] = await Promise.all([window.cci.getTeams(), window.cci.getOpponents()]);
  const lockedTeamId = teams.some((t) => t.id === ctx.teamId) ? ctx.teamId : null;
  const showHeader = ctx.header !== false;
  if (!teams.length) {
    if (showHeader) container.append(pageHeader('Reports', 'Exportable opponent and performance reports'));
    container.append(emptyState('No teams yet', 'Create a team and log some matches to generate reports.'));
    return;
  }

  const parsed = parseParam(ctx.param);
  const state = {
    type: parsed.type,
    teamId: lockedTeamId || teams[0].id,
    opponentId: parsed.opponentId || opponents[0]?.opponent_id || '',
  };

  if (showHeader) container.append(pageHeader('Reports', 'Exportable opponent and performance reports'));

  // ----- Controls -----
  const typeSelect = el('select', { onchange: (e) => { state.type = e.target.value; syncControls(); generate(); } }, [
    el('option', { value: 'team', selected: state.type === 'team' ? 'selected' : null }, 'Team Performance'),
    el('option', { value: 'opponent', selected: state.type === 'opponent' ? 'selected' : null }, 'Opponent Scout'),
  ]);
  const teamSelectEl = lockedTeamId
    ? null
    : el(
        'select',
        { onchange: (e) => { state.teamId = e.target.value; generate(); } },
        teams.map((t) => el('option', { value: t.id, selected: t.id === state.teamId ? 'selected' : null }, t.name))
      );
  const opponentSelectEl = opponents.length
    ? el(
        'select',
        { onchange: (e) => { state.opponentId = e.target.value; generate(); } },
        opponents.map((o) => el('option', { value: o.opponent_id, selected: o.opponent_id === state.opponentId ? 'selected' : null }, o.name))
      )
    : null;

  const controls = el('div', { class: 'filter-bar' }, [typeSelect, teamSelectEl, opponentSelectEl]);
  container.append(controls);

  function syncControls() {
    if (teamSelectEl) teamSelectEl.style.display = state.type === 'team' ? '' : 'none';
    if (opponentSelectEl) opponentSelectEl.style.display = state.type === 'opponent' ? '' : 'none';
  }
  syncControls();

  const preview = el('div', {});
  container.append(preview);

  async function generate() {
    preview.innerHTML = '';
    let report;
    if (state.type === 'opponent') {
      if (!opponents.length) {
        preview.append(emptyState('No opponents scouted', 'Add opponents in Scouting to generate scout reports.'));
        return;
      }
      const opponent = opponents.find((o) => o.opponent_id === state.opponentId) || opponents[0];
      const allMatches = await loadAllMatches();
      report = buildOpponentReport({ opponent, matches: allMatches });
    } else {
      const team = teams.find((t) => t.id === state.teamId) || teams[0];
      const [matches, members, scrims] = await Promise.all([
        window.cci.getMatches(team.id),
        window.cci.getMembers(team.id),
        window.cci.getScrims(team.id).catch(() => []),
      ]);
      report = buildTeamReport({ team, matches, members, scrims });
    }
    preview.append(renderReport(report));
  }

  await generate();
}

function parseParam(param) {
  if (param && param.startsWith('opponent/')) return { type: 'opponent', opponentId: param.split('/')[1] };
  return { type: 'team', opponentId: null };
}

async function loadAllMatches() {
  const teams = await window.cci.getTeams();
  const packs = await Promise.all(teams.map((team) => window.cci.getMatches(team.id)));
  return packs.flat();
}

function renderReport(report) {
  const wrap = el('div', {});

  wrap.append(
    el('div', { class: 'card', style: 'margin-bottom:16px;' }, [
      el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;' }, [
        el('div', {}, [
          el('div', { style: 'font-size:17px;font-weight:700;' }, report.title),
          el('div', { class: 'page-subtitle', style: 'margin-top:3px;' }, report.subtitle),
          el('div', { class: 'field-hint', style: 'margin-top:4px;' }, `Generated ${report.generatedAt.slice(0, 10)}`),
        ]),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' }, [
          exportBtn('copy', 'Copy Markdown', async () => {
            try {
              await navigator.clipboard.writeText(report.markdown);
              toast('Report copied as Markdown', 'ok');
            } catch {
              toast('Could not copy', 'error');
            }
          }),
          exportBtn('reports', 'Download .md', () => downloadText(`${slugName(report.title)}.md`, report.markdown)),
          exportBtn('panel', 'Print', () => window.print()),
        ]),
      ]),
    ])
  );

  if (report.kpis?.length) {
    wrap.append(
      el(
        'div',
        { class: 'kpi-row' },
        report.kpis.map((k) =>
          el('div', { class: 'kpi static' }, [
            el('div', { class: 'kpi-label' }, k.label),
            el('div', { class: 'kpi-value' }, String(k.value)),
            el('div', { class: 'kpi-meta' }, k.sub || ''),
          ])
        )
      )
    );
  }

  for (const section of report.sections || []) {
    const card = el('div', { class: 'card', style: 'margin-bottom:14px;' }, [
      el('div', { class: 'card-head' }, [
        el('div', { class: 'card-title' }, section.heading),
        section.note ? el('div', { class: 'card-meta' }, section.note) : null,
      ]),
    ]);
    if (!section.rows.length) {
      card.append(el('div', { class: 'field-hint', style: 'padding:4px 2px;' }, 'No data for this section.'));
    } else if (section.columns.length === 1) {
      card.append(el('div', { style: 'font-size:12.5px;line-height:1.6;color:var(--text-dim);white-space:pre-wrap;' }, section.rows.map((r) => r[0]).join('\n')));
    } else {
      card.append(
        el('table', {}, [
          el('thead', {}, el('tr', {}, section.columns.map((c) => el('th', {}, c)))),
          el('tbody', {}, section.rows.map((row) => el('tr', {}, row.map((value, i) => cell(value, i, section))))),
        ])
      );
    }
    wrap.append(card);
  }

  return wrap;
}

// Result cells render as coloured pills; everything else is plain text.
function cell(value, i, section) {
  const text = String(value);
  if ((section.columns[i] || '').toLowerCase() === 'result' && (text === 'Win' || text === 'Loss')) {
    return el('td', {}, el('span', { class: `pill ${text === 'Win' ? 'win' : 'loss'}` }, text));
  }
  return el('td', {}, text);
}

function exportBtn(iconName, label, onClick) {
  return el('button', { class: 'btn sm', onclick: onClick }, [
    el('span', { class: 'icon', style: 'display:inline-flex;vertical-align:-2px;margin-right:6px;', html: icon(iconName, 13) }),
    label,
  ]);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Report downloaded', 'ok');
}

function slugName(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report';
}
