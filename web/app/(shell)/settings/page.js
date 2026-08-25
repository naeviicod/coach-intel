import { SettingsView } from '../../../components/settings-view';
import { loadWorkspace } from '../../../lib/workspace';

export const metadata = { title: 'Settings · Coach Intel' };

export default async function Page() {
  const data = await loadWorkspace();
  return <SettingsView org={data.org} canEdit={data.canEdit} />;
}
