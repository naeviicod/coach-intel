import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Rankings · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Rankings"
      lede="How the field stacks up"
      emptyTitle="No rankings yet"
      emptyBody="Save a rankings snapshot in the desktop app and it will appear here."
    />
  );
}
