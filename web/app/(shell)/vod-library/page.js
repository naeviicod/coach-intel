import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'VOD Library · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="VOD Library"
      lede="Review VODs for the team"
      emptyTitle="No VODs yet"
      emptyBody="Add VODs in the desktop app and they sync here."
    />
  );
}
