// Rankings logic — pure, DOM-free.

export function winPct(team) {
  const played = (team.wins || 0) + (team.losses || 0);
  return played ? Math.round(((team.wins || 0) / played) * 100) : 0;
}

// Standings order: most points first, then win percentage, then more games
// played, then alphabetically so the table is stable between renders.
export function sortStandings(teams = []) {
  return [...teams].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    if (winPct(b) !== winPct(a)) return winPct(b) - winPct(a);
    const gpA = (a.wins || 0) + (a.losses || 0);
    const gpB = (b.wins || 0) + (b.losses || 0);
    if (gpB !== gpA) return gpB - gpA;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

// Your recent form from the match log — newest first, capped at `limit`.
export function formFromMatches(matches = [], limit = 10) {
  const ordered = [...matches].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
  const results = ordered.map((m) => (m.result === 'Win' ? 'W' : 'L'));
  const wins = results.filter((r) => r === 'W').length;
  return {
    results,
    wins,
    losses: results.length - wins,
    winRate: results.length ? Math.round((wins / results.length) * 100) : 0,
  };
}
