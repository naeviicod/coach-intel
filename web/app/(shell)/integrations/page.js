import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Integrations · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Integrations"
      lede="Discord bot and channel routing"
      emptyTitle="Managed in the desktop app"
      emptyBody="Connect the org bot from Settings → Integrations on desktop."
    />
  );
}
