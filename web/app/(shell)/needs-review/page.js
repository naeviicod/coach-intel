import { SectionPage } from '../../../components/section-page';

export const metadata = { title: 'Scoreboard Inbox · Coach Intel' };

export default function Page() {
  return (
    <SectionPage
      title="Scoreboard Inbox"
      lede="Screenshots waiting for review"
      emptyTitle="Queue clear"
      emptyBody="No screenshots waiting for review."
    />
  );
}
