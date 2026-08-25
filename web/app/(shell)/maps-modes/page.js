import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Maps & Modes · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Maps & Modes"
      lede="Callouts and objectives for the current ruleset"
      emptyTitle="Ruleset loaded"
      emptyBody="Map research is edited in the desktop app and shared with the org."
    />
  );
}
