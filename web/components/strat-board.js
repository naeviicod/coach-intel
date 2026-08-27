'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteDoc, newId, saveStrat } from '../lib/docs';
import { mapLayoutSrc } from '../lib/maps';
import { mapNames, modeNames } from '../lib/ruleset';
import { DRAW_COLOR, hitDrawingIndex, paintDrawings, paintOne } from '../lib/strat-draw';
import {
  DEFAULT_PIECE_SCALE, MAX_PER_TEAM, cleanPositions, clampPieceScale, normalizePos,
  spawnPositions, nextOpponentForMap, nextUsForMap, looksLikeLegacyCorners,
} from '../lib/strat-pieces';
import mapObjectives from '@knowledge/map-objectives.json';
import { Icon } from './icon';
import { Err } from './workspace';

const STATUSES = ['DRAFT', 'READY FOR REVIEW', 'APPROVED', 'IN PRACTICE', 'MATCH READY', 'ARCHIVED'];
const TOOLS = [
  { key: 'select', label: 'Select', shortcut: 'S' }, { key: 'pen', label: 'Draw', shortcut: 'D' },
  { key: 'arrow', label: 'Arrow', shortcut: 'A' }, { key: 'line', label: 'Line', shortcut: 'L' },
  { key: 'rect', label: 'Rectangle', shortcut: 'R' }, { key: 'zone', label: 'Circle', shortcut: 'C' },
  { key: 'text', label: 'Text', shortcut: 'T' }, { key: 'pin', label: 'Pin', shortcut: 'P' },
  { key: 'erase', label: 'Erase', shortcut: 'E' },
];

function normEvent(e, node) {
  const rect = node.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  };
}

function pieceSvg(number) {
  const id = `fov-${number}`;
  return `<svg class="board-fov" viewBox="-90 -110 180 160" width="180" height="160" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="-1"><stop offset="0%" stop-color="var(--piece)" stop-opacity="0.42"/><stop offset="70%" stop-color="var(--piece)" stop-opacity="0.12"/><stop offset="100%" stop-color="var(--piece)" stop-opacity="0"/></linearGradient></defs><path class="board-fov-cone" d="M 0 0 L -58 -86 A 104 104 0 0 1 58 -86 Z" fill="url(#${id})" /><polygon class="board-tri" points="0,-17 -13,14 13,14" /></svg>`;
}

export function StratBoard({ team, members, strat, ruleset, canEdit, onClose, onSaved }) {
  const roster = useMemo(() => (members || []).filter((m) => m.team_id === team.id), [members, team.id]);
  const maps = mapNames(ruleset);
  const modes = modeNames(ruleset);
  const existingId = strat?.strategy_id || strat?.id || null;
  const [name, setName] = useState(strat?.strategy_name || '');
  const [map, setMap] = useState(strat?.map || maps[0] || '');
  const [mode, setMode] = useState(strat?.mode || modes[0] || '');
  const [status, setStatus] = useState(strat?.status || 'DRAFT');
  const [objective, setObjective] = useState(strat?.objective_key || '');
  const [notes, setNotes] = useState(strat?.notes || '');
  const [scale, setScale] = useState(clampPieceScale(strat?.piece_scale ?? DEFAULT_PIECE_SCALE));
  const [positions, setPositions] = useState(() => {
    const existing = strat?.player_positions?.length ? strat.player_positions.map(normalizePos) : null;
    if (existing && !looksLikeLegacyCorners(existing)) return existing;
    return spawnPositions(roster, strat?.map || maps[0] || '', strat?.mode || modes[0] || '', mapObjectives);
  });
  const [tool, setTool] = useState('select');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const drawingsRef = useRef(Array.isArray(strat?.drawings) ? [...strat.drawings] : []);
  const historyRef = useRef({ stack: [JSON.parse(JSON.stringify(drawingsRef.current))], i: 0 });
  const strokeRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const layoutSrc = mapLayoutSrc(map, mode);
  const readOnly = !canEdit;
  const mapSeeded = useRef(Boolean(strat?.player_positions?.length) && !looksLikeLegacyCorners(strat.player_positions));

  useEffect(() => {
    if (mapSeeded.current) {
      mapSeeded.current = false;
      return;
    }
    setPositions(spawnPositions(roster, map, mode, mapObjectives));
  }, [map, mode]);

  function redraw() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const cx = canvas.getContext('2d');
    paintDrawings(cx, drawingsRef.current, canvas.width, canvas.height);
    if (strokeRef.current) paintOne(cx, strokeRef.current, canvas.width, canvas.height);
  }

  useEffect(() => {
    redraw();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  function commitDraw() {
    const hist = historyRef.current;
    hist.stack = hist.stack.slice(0, hist.i + 1);
    hist.stack.push(JSON.parse(JSON.stringify(drawingsRef.current)));
    if (hist.stack.length > 40) hist.stack.shift();
    hist.i = hist.stack.length - 1;
  }

  function undo() {
    const hist = historyRef.current;
    if (hist.i <= 0) return;
    hist.i -= 1;
    drawingsRef.current = JSON.parse(JSON.stringify(hist.stack[hist.i]));
    redraw();
  }

  function redo() {
    const hist = historyRef.current;
    if (hist.i >= hist.stack.length - 1) return;
    hist.i += 1;
    drawingsRef.current = JSON.parse(JSON.stringify(hist.stack[hist.i]));
    redraw();
  }

  function onCanvasDown(e) {
    if (readOnly || e.button !== 0) return;
    const canvas = canvasRef.current;
    const { x, y } = normEvent(e, canvas);
    if (tool === 'select') return;
    if (['pen', 'arrow', 'line', 'zone', 'rect'].includes(tool)) canvas.setPointerCapture(e.pointerId);
    if (tool === 'pen') strokeRef.current = { type: 'path', color: DRAW_COLOR, points: [[x, y]] };
    else if (tool === 'arrow' || tool === 'line') strokeRef.current = { type: tool, color: DRAW_COLOR, from: [x, y], to: [x, y] };
    else if (tool === 'zone') strokeRef.current = { type: 'zone', color: DRAW_COLOR, cx: x, cy: y, r: 0 };
    else if (tool === 'rect') strokeRef.current = { type: 'rect', color: DRAW_COLOR, a: [x, y], b: [x, y] };
    else if (tool === 'text') {
      const text = window.prompt('Label text:');
      if (text) {
        drawingsRef.current.push({ type: 'text', color: DRAW_COLOR, x, y, text });
        commitDraw();
        redraw();
      }
    } else if (tool === 'pin') {
      const text = window.prompt('Pin label (optional):');
      if (text !== null) {
        drawingsRef.current.push({ type: 'pin', color: DRAW_COLOR, x, y, text });
        commitDraw();
        redraw();
      }
    } else if (tool === 'erase') {
      const idx = hitDrawingIndex(drawingsRef.current, x, y);
      if (idx >= 0) {
        drawingsRef.current.splice(idx, 1);
        commitDraw();
        redraw();
      }
    }
  }

  function onCanvasMove(e) {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const { x, y } = normEvent(e, canvasRef.current);
    if (stroke.type === 'path') stroke.points.push([x, y]);
    else if (stroke.type === 'arrow' || stroke.type === 'line') stroke.to = [x, y];
    else if (stroke.type === 'zone') stroke.r = Math.hypot(x - stroke.cx, y - stroke.cy);
    else if (stroke.type === 'rect') stroke.b = [x, y];
    redraw();
  }

  function onCanvasUp(e) {
    const canvas = canvasRef.current;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    const stroke = strokeRef.current;
    if (!stroke) return;
    const keep =
      (stroke.type === 'path' && stroke.points.length > 1) ||
      ((stroke.type === 'arrow' || stroke.type === 'line') && Math.hypot(stroke.to[0] - stroke.from[0], stroke.to[1] - stroke.from[1]) > 0.01) ||
      (stroke.type === 'zone' && stroke.r > 0.015) ||
      (stroke.type === 'rect' && Math.hypot(stroke.b[0] - stroke.a[0], stroke.b[1] - stroke.a[1]) > 0.01);
    if (keep) {
      drawingsRef.current.push(stroke);
      commitDraw();
    }
    strokeRef.current = null;
    redraw();
  }

  function movePiece(index, next) {
    setPositions((list) => list.map((p, i) => (i === index ? { ...p, ...next } : p)));
  }

  function removePiece(index) {
    setPositions((list) => list.filter((_, i) => i !== index));
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      const saved = await saveStrat({
        teamId: team.id,
        existing: strat,
        strat: {
          strategy_name: name.trim() || undefined,
          map,
          mode,
          status,
          objective_key: objective,
          notes,
          piece_scale: scale,
          player_positions: cleanPositions(positions),
          drawings: drawingsRef.current,
          team_id: team.id,
        },
      });
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Could not save strat.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existingId || !window.confirm(`Delete "${name || 'this strat'}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteDoc({ kind: 'strat', teamId: team.id, id: existingId });
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not delete strat.');
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const saved = await saveStrat({
        teamId: team.id,
        existing: null,
        strat: {
          strategy_id: newId('strat'),
          strategy_name: `${name.trim() || 'Strat'} copy`,
          map,
          mode,
          status,
          objective_key: objective,
          notes,
          piece_scale: scale,
          player_positions: cleanPositions(positions),
          drawings: drawingsRef.current,
          team_id: team.id,
        },
      });
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Could not duplicate strat.');
    } finally {
      setBusy(false);
    }
  }

  const us = positions.filter((p) => !p.opponent);
  const them = positions.filter((p) => p.opponent);
  const placed = new Set(us.map((p) => p.member_id));

  return (
    <div className="board-studio-root">
      <div className="board-studio-bar">
        <button type="button" className="btn subtle" onClick={onClose}>← Playbook</button>
        <input
          type="text"
          value={name}
          placeholder="Strat name"
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          className="board-field"
          style={{ fontWeight: 700, fontSize: 14, width: 220 }}
        />
        <select value={map} disabled={readOnly} onChange={(e) => setMap(e.target.value)}>
          {maps.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={mode} disabled={readOnly} onChange={(e) => setMode(e.target.value)}>
          {modes.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input
          type="text"
          value={objective}
          placeholder="Hill / Site"
          disabled={readOnly}
          onChange={(e) => setObjective(e.target.value)}
          className="board-field"
          style={{ width: 132 }}
        />
        <select value={status} disabled={readOnly} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <label className="board-size edit-only">
          <span>Players</span>
          <input
            type="range"
            className="board-size-range"
            min="40"
            max="140"
            step="5"
            value={String(Math.round(scale * 100))}
            disabled={readOnly}
            onChange={(e) => setScale(clampPieceScale(Number(e.target.value) / 100))}
          />
          <span className="board-size-val">{Math.round(scale * 100)}%</span>
        </label>
        <div style={{ flex: 1 }} />
        {existingId && canEdit ? (
          <button type="button" className="btn subtle" onClick={duplicate} disabled={busy}>Duplicate</button>
        ) : null}
        {existingId && canEdit ? (
          <button type="button" className="btn subtle danger" onClick={remove} disabled={busy}>Delete</button>
        ) : null}
        {canEdit ? (
          <button type="button" className="btn primary" onClick={save} disabled={busy}>
            {existingId ? 'Save New Version' : 'Save Strat'}
          </button>
        ) : null}
      </div>
      {canEdit ? (
        <div className="board-hint">S select · D draw · A arrow · L line · R rect · C circle · T text · P pin · E erase · drag pieces · right-click rotate</div>
      ) : null}
      <div className="board-studio-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 196, flexShrink: 0 }}>
          <div className="card board-roster">
            <div className="section-title">Roster</div>
            <div className="board-roster-kicker">{`Us · ${us.length}/${MAX_PER_TEAM}`}</div>
            {us.map((pos, i) => {
              const member = roster.find((m) => m.id === pos.member_id);
              return (
                <div key={`us-${i}`} className="roster-row board-roster-row">
                  <span className="board-roster-tri" aria-hidden="true" />
                  <div className="board-roster-copy">
                    <div className="gamertag board-roster-name">{`${i + 1}  ${member?.gamertag || 'Player'}`}</div>
                    <span className="board-roster-on">On map</span>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="btn subtle sm board-roster-del"
                      aria-label={`Remove ${member?.gamertag || 'player'}`}
                      title="Remove from board"
                      onClick={() => setPositions((list) => list.filter((p) => p.member_id !== pos.member_id))}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {roster.filter((m) => !placed.has(m.id) && m.slot !== 'staff' && m.slot !== 'fa').map((member) => (
              <div
                key={member.id}
                className="roster-row board-roster-row"
                draggable={!readOnly}
                onDragStart={(e) => e.dataTransfer.setData('text/member-id', member.id)}
              >
                <span className="board-roster-tri" aria-hidden="true" />
                <div className="board-roster-copy">
                  <div className="gamertag board-roster-name">{member.gamertag}</div>
                  <span className="board-roster-on">Bench</span>
                </div>
                {!readOnly && us.length < MAX_PER_TEAM ? (
                  <button
                    type="button"
                    className="btn subtle sm board-roster-add"
                    aria-label={`Add ${member.gamertag} to the map`}
                    title="Add to map"
                    onClick={() => {
                      const slot = nextUsForMap(positions, member.id, map, mode, mapObjectives);
                      if (slot) setPositions((list) => [...list, slot]);
                    }}
                  >
                    <Icon name="plus" size={12} />
                  </button>
                ) : null}
              </div>
            ))}
            <div className="board-roster-kicker">{`Opponent · ${them.length}/${MAX_PER_TEAM}`}</div>
            {them.map((_, i) => (
              <div key={`them-${i}`} className="roster-row board-roster-row opponent">
                <span className="board-roster-tri opponent" aria-hidden="true" />
                <div className="board-roster-copy">
                  <div className="gamertag board-roster-name">{`${i + 5}  Opponent`}</div>
                  <span className="board-roster-on">On map</span>
                </div>
              </div>
            ))}
            {!readOnly && them.length < MAX_PER_TEAM ? (
              <button
                type="button"
                className="btn subtle"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => {
                  const slot = nextOpponentForMap(positions, map, mode, mapObjectives);
                  if (slot) setPositions((list) => [...list, slot]);
                }}
              >
                + Opponent
              </button>
            ) : null}
          </div>
          <label className="field">
            <span>Callouts / notes</span>
            <textarea rows={5} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="board-stage">
          {!readOnly ? (
            <div className="board-rail" role="toolbar" aria-label="Board tools">
              {TOOLS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`board-rail-btn${tool === item.key ? ' active' : ''}`}
                  title={`${item.label} (${item.shortcut})`}
                  aria-label={item.label}
                  onClick={() => setTool(item.key)}
                >
                  {item.shortcut}
                </button>
              ))}
              <div className="board-rail-gap" />
              <button type="button" className="board-rail-btn" title="Undo" aria-label="Undo" onClick={undo}>↶</button>
              <button type="button" className="board-rail-btn" title="Redo" aria-label="Redo" onClick={redo}>↷</button>
            </div>
          ) : null}
          <div
            ref={wrapRef}
            className="board-wrap"
            onContextMenu={(e) => e.preventDefault()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (readOnly) return;
              e.preventDefault();
              const memberId = e.dataTransfer.getData('text/member-id');
              if (!memberId) return;
              const { x, y } = normEvent(e, wrapRef.current);
              setPositions((list) => {
                const found = list.find((p) => p.member_id === memberId);
                if (found) return list.map((p) => (p === found ? { ...p, x, y } : p));
                if (list.filter((p) => !p.opponent).length >= MAX_PER_TEAM) return list;
                return [...list, normalizePos({ member_id: memberId, x, y, facing: 0 })];
              });
            }}
          >
            <div className={`board-bg${layoutSrc ? ' has-map' : ''} strat-map-preview`} data-layout="cover">
              {layoutSrc ? <img className="board-map" src={layoutSrc} alt={`${map} ${mode}`} /> : null}
              <div className="board-bg-label">{map || 'Select a map'}</div>
            </div>
            <canvas
              ref={canvasRef}
              className="board-canvas"
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
            />
            <div className="board-markers" style={{ ['--piece-scale']: String(scale) }}>
              {positions.map((pos, index) => {
                const member = roster.find((m) => m.id === pos.member_id);
                const number = pos.opponent
                  ? 5 + positions.filter((p, i) => p.opponent && i <= index).length - 1
                  : positions.filter((p, i) => !p.opponent && i <= index).length;
                const label = pos.opponent ? `Opp ${number}` : member?.gamertag || `P${number}`;
                return (
                  <div
                    key={`${pos.member_id || 'opp'}-${index}`}
                    className={`board-piece${pos.opponent ? ' opponent' : ' us'}${readOnly ? ' is-locked' : ''}`}
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      ['--facing']: `${(pos.facing * 180) / Math.PI}deg`,
                    }}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const rotate = e.button === 2;
                      const move = (ev) => {
                        if (rotate) {
                          const rect = wrapRef.current.getBoundingClientRect();
                          const cx = rect.left + pos.x * rect.width;
                          const cy = rect.top + pos.y * rect.height;
                          movePiece(index, { facing: Math.atan2(ev.clientX - cx, -(ev.clientY - cy)) });
                        } else {
                          movePiece(index, normEvent(ev, wrapRef.current));
                        }
                      };
                      const up = (ev) => {
                        e.currentTarget.releasePointerCapture(ev.pointerId);
                        e.currentTarget.removeEventListener('pointermove', move);
                        e.currentTarget.removeEventListener('pointerup', up);
                      };
                      e.currentTarget.addEventListener('pointermove', move);
                      e.currentTarget.addEventListener('pointerup', up);
                    }}
                  >
                    <div className="board-piece-rot" dangerouslySetInnerHTML={{ __html: pieceSvg(number) }} />
                    <div className="board-piece-n">{number}</div>
                    <div className="board-piece-label">{label}</div>
                    {!readOnly ? (
                      <button type="button" className="board-piece-x" aria-label={`Remove ${label}`} onClick={() => removePiece(index)}>
                        <Icon name="trash" size={11} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <Err error={error} />
    </div>
  );
}
