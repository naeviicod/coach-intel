import { hubHead } from '../parts.js';
import * as insights from '../../insights.js';

// The same performance view the org-wide Statistics page renders, scoped to
// this team. Kept as an embed rather than a copy so the two never drift: a
// player's K/D means the same thing in both places.
export async function render(root, hub) {
  root.append(
    hubHead('Statistics', `Player performance across ${hub.team.name}'s logged matches`, [hub.ctxToggle])
  );
  await insights.render(root, { ...hub, param: hub.team.id, header: false });
}
