import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Scouting · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Scouting"
      lede="Opponent notes and tendencies"
      emptyTitle="No opponents yet"
      emptyBody="Scout cards created in the desktop app sync here."
    />
  );
}
