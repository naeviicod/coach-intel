import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Intel Feed · Coach Intel' };

export default function IntelFeedPage() {
  return (
    <SectionPage
      title="Intel Feed"
      lede="Signals surface once teams have enough matches and scrims on the books."
      emptyTitle="No signals yet"
      emptyBody="Signals surface once teams have enough matches and scrims on the books."
    />
  );
}
