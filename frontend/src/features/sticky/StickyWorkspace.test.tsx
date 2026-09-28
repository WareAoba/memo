import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { StickyWorkspace } from './StickyWorkspace';
import { fitSticky, openScheduleSticky, type Sticky } from './stickyState';
import { getSchedule } from '../../api/schedules';
import { emptyFields } from '../../api/works';
import * as genie from './stickyGenie';
vi.mock('../../api/schedules');
const main = { current: document.createElement('main') };
const note: Sticky = {
  id: 'one',
  kind: 'note',
  target: '',
  text: '보존할 메모',
  title: '내 메모',
  x: 20,
  y: 20,
  width: 340,
  height: 360,
  state: 'open',
};
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  main.current.getBoundingClientRect = () => ({
    left: 100,
    top: 72,
    right: 1000,
    bottom: 800,
    width: 900,
    height: 728,
    x: 100,
    y: 72,
    toJSON: () => ({}),
  });
});
function mount(hidden = false) {
  return render(<StickyWorkspace accountId="a" main={main} hidden={hidden} today="2026-09-27" />);
}
it('preserves minimized notes through settings and reload, but removes closed notes', async () => {
  localStorage.setItem('preset.stickies.a', JSON.stringify([note]));
  const view = mount();
  fireEvent.change(screen.getByRole('textbox', { name: '자유 메모' }), {
    target: { value: '수정된 메모' },
  });
  fireEvent.click(screen.getByRole('button', { name: '최소화' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  view.rerender(<StickyWorkspace accountId="a" main={main} hidden today="2026-09-27" />);
  expect(screen.queryByRole('button', { name: '스티커 메모' })).not.toBeInTheDocument();
  view.rerender(<StickyWorkspace accountId="a" main={main} hidden={false} today="2026-09-27" />);
  fireEvent.click(screen.getByRole('button', { name: '스티커 메모' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '내 메모' }));
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue('수정된 메모');
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('preset.stickies.a')!)[0].state).toBe('open'),
  );
  view.unmount();
  mount();
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue('수정된 메모');
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(JSON.parse(localStorage.getItem('preset.stickies.a')!)).toEqual([]);
  act(() => window.dispatchEvent(new Event('sticky-manager')));
  expect(screen.queryByRole('button', { name: '내 메모' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue('');
});
it('does not load another account notes', () => {
  localStorage.setItem('preset.stickies.b', JSON.stringify([note]));
  mount();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
it('moves legacy notes only to the default track and restores each track separately', async () => {
  localStorage.setItem('preset.stickies.a', JSON.stringify([note]));
  const view = render(
    <StickyWorkspace
      key="default"
      accountId="a"
      trackId="default"
      defaultTrack
      main={main}
      hidden={false}
      today="2026-09-27"
    />,
  );
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue('보존할 메모');
  fireEvent.change(screen.getByRole('textbox', { name: '자유 메모' }), {
    target: { value: '공부 메모' },
  });
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('preset.stickies.a.default')!)[0].text).toBe(
      '공부 메모',
    ),
  );
  view.rerender(
    <StickyWorkspace
      key="exercise"
      accountId="a"
      trackId="exercise"
      main={main}
      hidden={false}
      today="2026-09-27"
    />,
  );
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  view.rerender(
    <StickyWorkspace
      key="default"
      accountId="a"
      trackId="default"
      defaultTrack
      main={main}
      hidden={false}
      today="2026-09-27"
    />,
  );
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue('공부 메모');
});
it('keeps drafts visible when browser storage fails', async () => {
  localStorage.setItem('preset.stickies.a', JSON.stringify([note]));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  mount();
  fireEvent.change(screen.getByRole('textbox', { name: '자유 메모' }), {
    target: { value: '잃으면 안 되는 입력' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('브라우저에 저장하지 못했습니다');
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue('잃으면 안 되는 입력');
});
it('drags and resizes with a captured pointer within content bounds', () => {
  localStorage.setItem('preset.stickies.a', JSON.stringify([note]));
  mount();
  const drag = screen.getByRole('button', { name: '내 메모 이동' });
  drag.setPointerCapture = vi.fn();
  const pointer = (target: HTMLElement, type: string, x: number, y: number) =>
    fireEvent(
      target,
      Object.assign(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }), {
        pointerId: 1,
      }),
    );
  pointer(drag, 'pointerdown', 30, 30);
  pointer(drag, 'pointermove', 3000, 3000);
  pointer(drag, 'pointerup', 3000, 3000);
  expect(screen.getByRole('region', { name: '내 메모' })).toHaveStyle({
    left: '560px',
    top: '336px',
  });
  const resize = screen.getByRole('button', { name: '크기 조절' });
  resize.setPointerCapture = vi.fn();
  pointer(resize, 'pointerdown', 500, 500);
  pointer(resize, 'pointermove', 300, 400);
  pointer(resize, 'pointerup', 300, 400);
  expect(screen.getByRole('region', { name: '내 메모' })).toHaveStyle({
    width: '260px',
    height: '260px',
    left: '560px',
    top: '336px',
  });
});
it('opens one window per schedule even when requested twice', async () => {
  vi.mocked(getSchedule).mockResolvedValue({
    ...emptyFields,
    id: 's',
    entity_id: null,
    title: '스케줄',
    scheduled_date: '2026-09-27',
    end_date: '2026-09-27',
    start_time: '09:00',
    end_time: '10:00',
    time_zone: 'Asia/Tokyo',
    notes: '',
    status: 'planned',
    created_at: '',
    updated_at: '',
    entity_snapshot: emptyFields,
    tasks: [],
    color: 'blue',
  });
  mount();
  act(() => openScheduleSticky('s', '스케줄'));
  act(() => openScheduleSticky('s', '스케줄'));
  await screen.findByRole('link', { name: '스케줄' });
  expect(screen.getAllByRole('button', { name: '닫기' })).toHaveLength(1);
  expect(screen.getByRole('region', { name: '스케줄' })).toHaveAttribute(
    'data-schedule-color',
    'blue',
  );
  vi.mocked(getSchedule).mockResolvedValue({ ...(await getSchedule('s')), color: 'green' });
  act(() => window.dispatchEvent(new Event('schedules-changed')));
  await waitFor(() =>
    expect(screen.getByRole('region', { name: '스케줄' })).toHaveAttribute(
      'data-schedule-color',
      'green',
    ),
  );
  const effect = vi.spyOn(genie, 'stickyGenie').mockReturnValue(() => {});
  fireEvent.click(screen.getByRole('button', { name: '최소화' }));
  fireEvent.click(screen.getByRole('button', { name: '스티커 메모' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '스케줄' }));
  expect(effect).toHaveBeenLastCalledWith(expect.any(HTMLElement), true);
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(JSON.parse(localStorage.getItem('preset.stickies.a')!)).toEqual([]);
  effect.mockClear();
  act(() => openScheduleSticky('s', '스케줄'));
  await screen.findByRole('link', { name: '스케줄' });
  expect(effect).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('preset.stickies.a')!)[0]).toMatchObject({
    state: 'open',
    x: 24,
    y: 24,
  });
  effect.mockRestore();
});
it('activates only the clicked or focused note and clears activation outside it', () => {
  localStorage.setItem(
    'preset.stickies.a',
    JSON.stringify([note, { ...note, id: 'two', title: '두 번째' }]),
  );
  mount();
  const first = screen.getByRole('region', { name: '내 메모' });
  const second = screen.getByRole('region', { name: '두 번째' });
  fireEvent.pointerDown(first);
  expect(first).toHaveAttribute('data-sticky-active', 'true');
  fireEvent.pointerDown(second);
  expect(first).toHaveAttribute('data-sticky-active', 'false');
  expect(second).toHaveAttribute('data-sticky-active', 'true');
  fireEvent.pointerDown(document.body);
  expect(second).toHaveAttribute('data-sticky-active', 'false');
  fireEvent.focus(screen.getByRole('button', { name: '내 메모 이동' }));
  expect(first).toHaveAttribute('data-sticky-active', 'true');
  expect(screen.getByRole('button', { name: '내 메모 이동' })).toHaveTextContent('');
});
it('restores persisted minimized notes from the tray with keyboard navigation', () => {
  localStorage.setItem(
    'preset.stickies.a',
    JSON.stringify([
      { ...note, state: 'minimized' },
      { ...note, id: 'two', title: '다음 메모', state: 'minimized' },
    ]),
  );
  mount();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  const tray = screen.getByRole('button', { name: '스티커 메모' });
  expect(tray).toHaveTextContent('');
  fireEvent.keyDown(tray, { key: 'ArrowUp' });
  const second = screen.getByRole('menuitem', { name: '다음 메모' });
  expect(second).toHaveFocus();
  fireEvent.keyDown(second, { key: 'Home' });
  expect(screen.getByRole('menuitem', { name: '스티커 추가' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '내 메모' }), { key: 'Escape' });
  expect(tray).toHaveFocus();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.click(tray);
  fireEvent.click(screen.getByRole('menuitem', { name: '내 메모' }));
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue(note.text);
  expect(screen.getByRole('region', { name: '내 메모' })).toHaveStyle({
    left: '20px',
    top: '20px',
    width: '340px',
    height: '360px',
  });
  expect(tray).toHaveTextContent('');
});
it('creates a free note directly from an empty tray without another dialog', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: '스티커 메모' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '스티커 추가' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: '제목' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '자유 메모' }), {
    target: { value: '본문으로 찾는 메모' },
  });
  fireEvent.click(screen.getByRole('button', { name: '최소화' }));
  fireEvent.click(screen.getByRole('button', { name: '스티커 메모' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '본문으로 찾는 메모' }));
  expect(screen.getByRole('textbox', { name: '자유 메모' })).toHaveValue('본문으로 찾는 메모');
});
it('constrains geometry on small screens and supports keyboard move and resize', () => {
  expect(
    fitSticky({ ...note, x: 2000, y: -100, width: 2000, height: 2000 }, 320, 500),
  ).toMatchObject({ x: 0, y: 0, width: 320, height: 500 });
  localStorage.setItem('preset.stickies.a', JSON.stringify([note]));
  mount();
  fireEvent.keyDown(screen.getByRole('button', { name: '내 메모 이동' }), { key: 'ArrowRight' });
  fireEvent.keyDown(screen.getByRole('button', { name: '크기 조절' }), { key: 'ArrowDown' });
  expect(screen.getByRole('region', { name: '내 메모' })).toHaveStyle({
    left: '30px',
    height: '370px',
  });
});
