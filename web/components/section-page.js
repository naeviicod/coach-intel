import { PageHeader, EmptyState } from './page-header';

export function SectionPage({ title, lede, emptyTitle, emptyBody }) {
  return (
    <>
      <PageHeader title={title} subtitle={lede} />
      <EmptyState title={emptyTitle} body={emptyBody} />
    </>
  );
}
