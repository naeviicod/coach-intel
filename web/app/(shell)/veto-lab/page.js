import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Veto Lab · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Veto Lab"
      lede="Ban/pick plans for the next series"
      emptyTitle="No veto plan yet"
      emptyBody="Save a veto in the desktop app and it stays on the opponent scout card."
    />
  );
}
