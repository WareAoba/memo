export type EditTarget = { kind: 'schedules' | 'works' | 'tasks'; id: string };
export type WorkspaceOverlay =
  | { kind: 'edit'; target: EditTarget }
  | { kind: 'schedule'; date?: string }
  | { kind: 'preset'; preset: 'works' | 'tasks' }
  | { kind: 'settings' }
  | null;
export type WorkspaceRoute = { page: string; overlay: WorkspaceOverlay };
export const trackFromHash = (hash: string) => new URLSearchParams(hash.split('?')[1]).get('track');

export function parseWorkspaceRoute(hash: string): WorkspaceRoute {
  let path = hash.replace(/^#/, '').replace(/^\/entities(?=\/|$)/, '/presets/works');
  if (!path) path = '/today';
  if (path === '/schedules' || path === '/schedules/') path = '/calendar';
  if (path === '/presets') path = '/presets/works';
  if (path.split('?')[0] === '/schedules/new') {
    return {
      page: '/calendar',
      overlay: {
        kind: 'schedule',
        date: new URLSearchParams(path.split('?')[1]).get('date') || undefined,
      },
    };
  }
  path = path.split('?')[0]!;
  const match = /^\/(schedules|presets\/(works|tasks))\/([^/?]+)(?:\/edit)?$/.exec(path);
  if (!match) return { page: path, overlay: null };
  const kind = (match[2] || match[1]) as EditTarget['kind'];
  const page = kind === 'schedules' ? '/today' : '/presets/' + kind;
  if (match[3] === 'new') {
    if (path.endsWith('/edit')) return { page: path, overlay: null };
    return { page, overlay: kind === 'schedules' ? null : { kind: 'preset', preset: kind } };
  }
  return { page, overlay: { kind: 'edit', target: { kind, id: match[3]! } } };
}

export type WorkspaceAction =
  { type: 'navigate'; hash: string } | { type: 'settings' } | { type: 'close' } | { type: 'reset' };

export function workspaceRouteReducer(
  state: WorkspaceRoute,
  action: WorkspaceAction,
): WorkspaceRoute {
  switch (action.type) {
    case 'navigate': {
      const next = parseWorkspaceRoute(action.hash);
      return next.overlay ? { ...state, overlay: next.overlay } : next;
    }
    case 'settings':
      return { ...state, overlay: { kind: 'settings' } };
    case 'close':
      return { ...state, overlay: null };
    case 'reset':
      return { page: '/today', overlay: state.overlay?.kind === 'settings' ? state.overlay : null };
  }
}
