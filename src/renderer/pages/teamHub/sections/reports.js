import { hubHead } from '../parts.js';
import * as reports from '../../reports.js';

// Team-locked build of the org Reports page: same generator, same export
// buttons, without the team picker the hub already answers.
export async function render(root, hub) {
  root.append(
    hubHead('Reports', 'Exportable performance and opponent scout reports for this team', [hub.ctxToggle])
  );
  await reports.render(root, { ...hub, teamId: hub.team.id, param: null, header: false });
}
