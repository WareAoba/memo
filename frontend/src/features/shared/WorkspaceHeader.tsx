import type { ReactNode } from 'react';
import './workspace-header.css';
export function WorkspaceHeader({
  title,
  actions,
  navigation,
  tools,
}: {
  title: ReactNode;
  actions?: ReactNode;
  navigation?: ReactNode;
  tools?: ReactNode;
}) {
  return (
    <header className="workspace-page-header">
      <div className="workspace-title-row">
        {title}
        {navigation && <div className="workspace-navigation-row">{navigation}</div>}
      </div>
      {(tools || actions) && (
        <div className="workspace-toolbar-row">
          <div className="workspace-tools-row">{tools}</div>
          {actions && <div className="workspace-page-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}
