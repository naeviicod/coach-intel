import { redirect } from 'next/navigation';
import { hubPath, parseHubSection } from '../../../../../lib/hub';

export default async function LegacyTeamPage({ params }) {
  const { id, section: sectionParts } = await params;
  const { key, sub } = parseHubSection(sectionParts);
  redirect(hubPath(decodeURIComponent(id), key, ...sub));
}
