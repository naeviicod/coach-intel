import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Reports · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Reports"
      lede="Team and opponent reports"
      emptyTitle="No reports yet"
      emptyBody="Reports build once matches are on the books."
    />
  );
}
