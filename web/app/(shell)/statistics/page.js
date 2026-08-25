import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Statistics · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Statistics"
      lede="Performance across the organization"
      emptyTitle="No matches yet"
      emptyBody="Log maps and league matches and this page fills in."
    />
  );
}
