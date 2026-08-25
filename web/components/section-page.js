export function SectionPage({ title, lede, emptyTitle, emptyBody }) {
  return (
    <>
      <header className="page-head">
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </header>
      <div className="empty-card">
        <h2>{emptyTitle}</h2>
        {emptyBody ? <p>{emptyBody}</p> : null}
      </div>
    </>
  );
}
