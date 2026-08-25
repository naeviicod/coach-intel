import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Scrim Hub · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Scrim Hub"
      lede="Scrims and map results"
      emptyTitle="No scrims yet"
      emptyBody="Record scrims in the desktop app and they sync here."
    />
  );
}
