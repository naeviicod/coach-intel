export default function Loading() {
  return (
    <div className="hub-loading" aria-busy="true" aria-label="Loading">
      <div className="kpi-row">
        <div className="kpi" />
        <div className="kpi" />
        <div className="kpi" />
        <div className="kpi" />
      </div>
      <div className="card compact" style={{ minHeight: 140 }} />
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card compact" style={{ minHeight: 120 }} />
        <div className="card compact" style={{ minHeight: 120 }} />
      </div>
    </div>
  );
}
