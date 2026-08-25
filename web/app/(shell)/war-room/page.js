import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'War Room · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="War Room"
      lede="Objectives and prep for the next match"
      emptyTitle="Nothing staged"
      emptyBody="Match prep lives here once maps are on the calendar."
    />
  );
}
