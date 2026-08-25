export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{title}</div>
        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
      </div>
      {actions || null}
    </div>
  );
}

export function EmptyState({ title, body, children }) {
  return (
    <div className="card empty-state">
      <div className="title">{title}</div>
      {body ? <div>{body}</div> : null}
      {children}
    </div>
  );
}
