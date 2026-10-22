export default function WorkspaceLoading() {
  return (
    <main className="workspace-route-loading" aria-busy="true" aria-live="polite">
      <div className="workspace-route-loading-heading">
        <span className="workspace-route-loading-mark" aria-hidden="true">E</span>
        <div>
          <p className="eyebrow">ECOTWIN · CAMPUS OPERATIONS</p>
          <h1>Opening your workspace</h1>
          <p className="muted">Loading your authorized campus information…</p>
        </div>
      </div>
      <div className="workspace-route-loading-grid" aria-hidden="true">
        <div className="workspace-route-loading-card"><i /><i /><i /></div>
        <div className="workspace-route-loading-card"><i /><i /><i /></div>
        <div className="workspace-route-loading-card"><i /><i /><i /></div>
      </div>
      <span className="workspace-route-loading-status">Please wait</span>
    </main>
  );
}
