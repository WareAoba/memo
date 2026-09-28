import { describe, expect, it } from 'vitest';
import { parseWorkspaceRoute, workspaceRouteReducer } from './workspaceRoute';

describe('workspace navigation', () => {
  it.each([
    ['#/entities/abc/edit', '/presets/works', 'edit'],
    ['#/presets/tasks/new', '/presets/tasks', 'preset'],
    ['#/schedules/new?date=2026-09-27', '/calendar', 'schedule'],
    ['#/schedules/abc', '/today', 'edit'],
    ['#/schedules', '/calendar', undefined],
    ['#/presets', '/presets/works', undefined],
    ['', '/today', undefined],
  ])('opens %s on its compatible background', (hash, page, kind) => {
    const route = parseWorkspaceRoute(hash);
    expect(route.page).toBe(page);
    expect(route.overlay?.kind).toBe(kind);
  });

  it('keeps the background while replacing every overlay and preserves the date', () => {
    let state = parseWorkspaceRoute('#/calendar');
    state = workspaceRouteReducer(state, { type: 'navigate', hash: '#/presets/works/new' });
    state = workspaceRouteReducer(state, {
      type: 'navigate',
      hash: '#/schedules/new?date=2026-10-02',
    });
    expect(state).toEqual({ page: '/calendar', overlay: { kind: 'schedule', date: '2026-10-02' } });
    state = workspaceRouteReducer(state, { type: 'settings' });
    expect(state).toEqual({ page: '/calendar', overlay: { kind: 'settings' } });
    state = workspaceRouteReducer(state, { type: 'close' });
    expect(state).toEqual({ page: '/calendar', overlay: null });
  });

  it('clears editing on page navigation and resets the hidden background from settings', () => {
    const state = parseWorkspaceRoute('#/schedules/abc/edit');
    expect(workspaceRouteReducer(state, { type: 'navigate', hash: '#/presets/tasks' })).toEqual({
      page: '/presets/tasks',
      overlay: null,
    });
    expect(workspaceRouteReducer(state, { type: 'reset' })).toEqual({
      page: '/today',
      overlay: null,
    });
    expect(
      workspaceRouteReducer(workspaceRouteReducer(state, { type: 'settings' }), { type: 'reset' }),
    ).toEqual({
      page: '/today',
      overlay: { kind: 'settings' },
    });
  });
});
