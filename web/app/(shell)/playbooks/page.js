import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Strats & Playbooks · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Strats & Playbooks"
      lede="Shared strats for the team"
      emptyTitle="No strats yet"
      emptyBody="Create strats in the desktop app and they sync here."
    />
  );
}
