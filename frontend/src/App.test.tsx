import { bootstrapSettings, defaultSettings } from './api/settings';
vi.mock('./api/settings', async (original) => ({
  ...(await original<typeof import('./api/settings')>()),
  bootstrapSettings: vi.fn(),
}));
import { getWorkTasks } from './api/workTasks';
vi.mock('./api/workTasks', () => ({ getWorkTasks: vi.fn(async () => []) }));
import {
  getDaySchedules,
  getSchedule,
  getRangeSchedules,
  saveSchedule,
  listSchedules,
  type ScheduleDetail,
} from './api/schedules';
vi.mock('./api/schedules', async (original) => ({
  ...(await original<typeof import('./api/schedules')>()),
  getDaySchedules: vi.fn(),
  getSchedule: vi.fn(),
  getRangeSchedules: vi.fn(),
  saveSchedule: vi.fn(),
  listSchedules: vi.fn(),
}));
import { listTaskPresets } from './api/taskPresets';
vi.mock('./api/taskPresets', async (original) => ({
  ...(await original<typeof import('./api/taskPresets')>()),
  listTaskPresets: vi.fn(),
}));
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { archiveWork, emptyFields, getWork, listWorks, saveWork } from './api/works';
import type { Work } from './api/works';
vi.mock('./api/works', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/works')>()),
  archiveWork: vi.fn(),
  getWork: vi.fn(),
  initializeLocalUser: vi.fn(),
  listWorks: vi.fn(),
  saveWork: vi.fn(),
}));
const work: Work = {
  ...emptyFields,
  id: '00000000-0000-4000-8000-000000000003',
  name: '중앙 워크',
  address: '서울',
  parking_info: '기존 주차 안내',
  special_notes: '기존 계약 메모',
  tags: ['정기'],
  advance_contact_required: true,
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
};
beforeEach(() => {
  vi.mocked(getWorkTasks).mockResolvedValue([]);
  vi.mocked(getDaySchedules).mockResolvedValue([]);
  vi.mocked(getRangeSchedules).mockResolvedValue([]);
  vi.mocked(listTaskPresets).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
  window.history.replaceState(null, '', '#/entities');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(bootstrapSettings).mockResolvedValue({ ...defaultSettings, time_zone: 'Asia/Tokyo' });
  vi.mocked(listWorks).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
describe('work workspace', () => {
  it('shows empty state and recovers a failed list through retry', async () => {
    vi.mocked(listWorks)
      .mockRejectedValueOnce(new Error('연결 실패'))
      .mockResolvedValueOnce({ items: [], total: 0, offset: 0, limit: 20 });
    render(<App />);
    expect(await screen.findByText('연결 실패')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('첫 워크를 등록해 보세요.')).toBeInTheDocument();
  });
  it('searches and switches archive scope with pagination reset', async () => {
    vi.mocked(listWorks).mockResolvedValue({ items: [work], total: 49, offset: 0, limit: 20 });
    render(<App />);
    expect(await screen.findByText('중앙 워크')).toBeInTheDocument();
    expect(screen.queryByText('사전 연락 필요')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() =>
      expect(listWorks).toHaveBeenLastCalledWith('', false, 48, expect.any(AbortSignal), 48),
    );
    fireEvent.change(screen.getByRole('searchbox', { name: '워크 검색' }), {
      target: { value: '서울' },
    });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() =>
      expect(listWorks).toHaveBeenLastCalledWith('서울', false, 0, expect.any(AbortSignal), 48),
    );
    fireEvent.click(screen.getByRole('button', { name: '보관함' }));
    await waitFor(() =>
      expect(listWorks).toHaveBeenLastCalledWith('서울', true, 0, expect.any(AbortSignal), 48),
    );
  });
  it('retains form values after failure and creates on retry', async () => {
    window.location.hash = '/entities/new';
    vi.mocked(saveWork).mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValueOnce(work);
    vi.mocked(getWork).mockResolvedValue(work);
    render(<App />);
    fireEvent.change(screen.getByLabelText('워크 이름 *'), { target: { value: '중앙 워크' } });
    fireEvent.change(screen.getByLabelText('태그'), { target: { value: '정기, 방문' } });
    fireEvent.click(screen.getByRole('button', { name: '워크 저장' }));
    expect(await screen.findByText('저장 실패')).toBeInTheDocument();
    expect(screen.getByLabelText('워크 이름 *')).toHaveValue('중앙 워크');
    fireEvent.click(screen.getByRole('button', { name: '워크 저장' }));
    await waitFor(() => expect(window.location.hash).toBe('#/presets/works'));
    expect(saveWork).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: '중앙 워크', tags: ['정기', '방문'] }),
      undefined,
    );
  });
  it('rejects duplicate custom information names before saving', async () => {
    window.location.hash = '/entities/new';
    render(<App />);
    fireEvent.change(screen.getByLabelText('워크 이름 *'), { target: { value: '워크' } });
    fireEvent.click(screen.getByRole('button', { name: '정보 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '정보 추가' }));
    screen.getAllByLabelText('종류').forEach((input) => {
      fireEvent.click(input);
      fireEvent.click(screen.getByRole('option', { name: '직접 입력' }));
      fireEvent.change(input, { target: { value: '장소' } });
    });
    fireEvent.click(screen.getByRole('button', { name: '워크 저장' }));
    expect(await screen.findByText('같은 종류를 중복해서 사용할 수 없습니다.')).toBeInTheDocument();
    expect(saveWork).not.toHaveBeenCalled();
  });
  it('archives and restores an existing work', async () => {
    window.location.hash = '/entities/' + work.id;
    vi.mocked(getWork).mockResolvedValue(work);
    vi.mocked(archiveWork).mockResolvedValue();
    vi.mocked(saveWork).mockResolvedValue(work);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '워크 보관' }));
    expect(await screen.findByText('보관된 워크')).toBeInTheDocument();
    expect(archiveWork).toHaveBeenCalledWith(work.id);
    fireEvent.click(screen.getByRole('button', { name: '워크 복원' }));
    expect(await screen.findByRole('button', { name: '워크 보관' })).toBeEnabled();
    expect(saveWork).toHaveBeenCalledWith({ archived: false }, work.id);
  });
  it('loads edit fields and submits only writable fields', async () => {
    window.location.hash = '/entities/' + work.id + '/edit';
    vi.mocked(getWork).mockResolvedValue(work);
    vi.mocked(saveWork).mockResolvedValue(work);
    render(<App />);
    expect(await screen.findByLabelText('워크 이름 *')).toHaveValue('중앙 워크');
    fireEvent.change(screen.getByLabelText('워크 이름 *'), { target: { value: '부산' } });
    fireEvent.click(screen.getByRole('button', { name: '워크 저장' }));
    await waitFor(() => expect(saveWork).toHaveBeenCalled());
    expect(vi.mocked(saveWork).mock.calls[0]![0]).not.toHaveProperty('id');
    expect(vi.mocked(saveWork).mock.calls[0]![0]).toHaveProperty('name', '부산');
    expect(vi.mocked(saveWork).mock.calls[0]![0]).toHaveProperty('parking_info', '기존 주차 안내');
    expect(vi.mocked(saveWork).mock.calls[0]![0]).toHaveProperty('special_notes', '기존 계약 메모');
  });
});

describe('three-destination workspace structure', () => {
  it('starts with today and has exactly three primary destinations', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    expect(screen.getByRole('heading', { name: '오늘' })).toBeInTheDocument();
    const navigation = within(screen.getByRole('navigation', { name: '주 메뉴' }));
    expect(
      screen
        .getByRole('navigation', { name: '주 메뉴' })
        .querySelectorAll(':scope > a, :scope > .sidebar-group > .sidebar-row > a'),
    ).toHaveLength(3);
    expect(navigation.getByRole('link', { name: '당일 요약' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByText('화면 구조 미리보기')).not.toBeInTheDocument();
    expect(await screen.findByText('오늘 저장된 스케줄이 없습니다.')).toBeInTheDocument();
    expect(listWorks).not.toHaveBeenCalled();
  });
  it('loads saved calendar schedules without preview controls', async () => {
    window.history.replaceState(null, '', '#/calendar');
    render(<App />);
    expect(await screen.findByRole('region', { name: '월 캘린더' })).toBeInTheDocument();
    await waitFor(() => expect(getRangeSchedules).toHaveBeenCalled());
    expect(getRangeSchedules).toHaveBeenCalled();
    expect(screen.queryByText('예시 끄기')).not.toBeInTheDocument();
  });
  it('separates stored work and task presets', async () => {
    window.history.replaceState(null, '', '#/presets/tasks');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }));
    fireEvent.click(screen.getByRole('button', { name: '프리셋 종류 메뉴' }));
    const navigation = within(screen.getByRole('navigation', { name: '프리셋 종류' }));
    expect(navigation.getAllByRole('link')).toHaveLength(2);
    expect(navigation.getByRole('link', { name: '태스크' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByText('첫 태스크를 등록해 보세요.')).toBeInTheDocument();
    expect(listTaskPresets).toHaveBeenCalled();
    fireEvent.click(navigation.getByRole('link', { name: '워크' }));
    expect(await screen.findByText('첫 워크를 등록해 보세요.')).toBeInTheDocument();
    expect(listWorks).toHaveBeenCalled();
  });
  it('moves calendar months and returns to today', async () => {
    window.history.replaceState(null, '', '#/calendar');
    render(<App />);
    const label = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    expect(screen.queryByRole('heading', { name: label })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '오늘' }));
    expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '일간 스케줄 상세' })).not.toBeInTheDocument();
  });
});

it('switches calendar views through the tab drawer', async () => {
  window.history.replaceState(null, '', '#/calendar');
  render(<App />);
  await screen.findByRole('region', { name: '월 캘린더' });
  fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }));
  fireEvent.click(screen.getByLabelText('캘린더 보기 메뉴'));
  fireEvent.click(screen.getByRole('link', { name: '연도별로 월 선택' }));
  expect(screen.queryByRole('region', { name: '월 캘린더' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /12월/ }));
  expect(screen.getByRole('region', { name: '월 캘린더' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }));
  fireEvent.click(screen.getByRole('link', { name: '일간 상세 보기' }));
  expect(screen.getByRole('region', { name: '일간 스케줄 상세' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '이 날짜에 스케줄 만들기' })).toHaveAttribute(
    'href',
    expect.stringContaining('-12-01'),
  );
});

it('expands the icon rail and preserves navigation when collapsed', async () => {
  render(<App />);
  expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }));
  expect(screen.getByRole('button', { name: '메뉴 접기' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: '메뉴 접기' }));
  expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }));
  expect(screen.queryByRole('button', { name: '메뉴 펼치기' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '프리셋 종류 메뉴' }));
  expect(screen.getByRole('navigation', { name: '프리셋 종류' })).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('main'));
  fireEvent.click(screen.getByRole('main'));
  expect(screen.getByRole('button', { name: '메뉴 펼치기' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: '프리셋 종류' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '프리셋 설정' })).toBeInTheDocument();
  await screen.findByText('첫 워크를 등록해 보세요.');
});

it('creates a schedule in a dialog while preserving the calendar date and route', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
  window.history.replaceState(null, '', '#/calendar');
  vi.mocked(listWorks).mockResolvedValue({ items: [work], total: 1, limit: 20, offset: 0 });
  vi.mocked(getWorkTasks).mockResolvedValue([]);
  vi.mocked(saveSchedule).mockResolvedValue({ id: 'new-schedule' } as ScheduleDetail);
  render(<App />);
  await screen.findByRole('region', { name: '월 캘린더' });
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
  fireEvent.click(screen.getByRole('button', { name: /월 15일.*스케줄 0개/ }));
  const launch = screen.getByRole('link', { name: '이 날짜에 스케줄 만들기' });
  const date = launch.getAttribute('href')!.split('date=')[1];
  const calendar = screen.getByRole('region', { name: '일간 스케줄 상세' });
  launch.focus();
  fireEvent.click(launch);
  let dialog = await screen.findByRole('dialog', { name: '스케줄 추가' });
  expect(window.location.hash).toBe('#/calendar');
  expect(calendar).toBeInTheDocument();
  expect(within(dialog).queryByLabelText('스케줄 날짜')).not.toBeInTheDocument();
  expect(within(dialog).queryByLabelText('시작 날짜')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByLabelText('여러 날에 걸친 스케줄'));
  expect(within(dialog).getByLabelText('시작 날짜')).toHaveValue(date);
  fireEvent.click(within(dialog).getByLabelText('여러 날에 걸친 스케줄'));
  expect(
    within(dialog)
      .getByRole('button', { name: /스케줄 저장/ })
      .closest('.modal-footer'),
  ).not.toBeNull();
  expect(within(dialog).queryByRole('button', { name: '취소' })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '스케줄 추가 닫기' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(launch).toHaveFocus();
  fireEvent.click(launch);
  dialog = await screen.findByRole('dialog', { name: '스케줄 추가' });
  fireEvent.change(within(dialog).getByRole('searchbox', { name: '워크 검색' }), {
    target: { value: '중앙' },
  });
  fireEvent.click(await within(dialog).findByRole('button', { name: '중앙 워크 선택' }));
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: /스케줄 저장/ })).toBeEnabled(),
  );
  const before = vi.mocked(getRangeSchedules).mock.calls.length;
  fireEvent.click(within(dialog).getByRole('button', { name: /스케줄 저장/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(saveSchedule).toHaveBeenCalledWith(
    expect.objectContaining({ scheduled_date: date, entity_id: work.id }),
    undefined,
  );
  expect(window.location.hash).toBe('#/calendar');
  expect(screen.getByRole('region', { name: '일간 스케줄 상세' })).toBe(calendar);
  expect(screen.getByRole('link', { name: '이 날짜에 스케줄 만들기' })).toHaveAttribute(
    'href',
    '#/schedules/new?date=' + date,
  );
  await waitFor(() =>
    expect(vi.mocked(getRangeSchedules).mock.calls.length).toBeGreaterThan(before),
  );
});
it('opens a direct schedule creation URL as a dialog over the calendar', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
  vi.mocked(listSchedules).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  window.history.replaceState(null, '', '#/schedules/new?date=2026-11-02');
  render(<App />);
  const dialog = await screen.findByRole('dialog', { name: '스케줄 추가' });
  expect(within(dialog).queryByLabelText('시작 날짜')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByLabelText('여러 날에 걸친 스케줄'));
  expect(within(dialog).getByLabelText('시작 날짜')).toHaveValue('2026-11-02');
  fireEvent.click(within(dialog).getByRole('button', { name: '스케줄 추가 닫기' }));
  expect(window.location.hash).toBe('#/calendar');
  expect(screen.getByRole('heading', { name: '캘린더' })).toBeInTheDocument();
});

it('opens work registration after a full pointer click with the sidebar expanded', async () => {
  window.history.replaceState(null, '', '#/presets/works');
  vi.mocked(saveWork).mockResolvedValue(work);
  render(<App />);
  await screen.findByText('첫 워크를 등록해 보세요.');
  fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기' }));
  const trigger = screen.getByRole('link', { name: '+ 워크 등록' });
  trigger.focus();
  fireEvent.pointerDown(trigger);
  expect(screen.getByRole('button', { name: '프리셋 종류 메뉴' })).toBeInTheDocument();
  fireEvent.pointerUp(trigger);
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: '워크 등록' });
  expect(screen.getByRole('button', { name: '프리셋 종류 메뉴' })).toBeInTheDocument();
  expect(window.location.hash).toBe('#/presets/works');
  fireEvent.change(within(dialog).getByLabelText('워크 이름 *'), {
    target: { value: '추가한 워크' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: '워크 저장' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(saveWork).toHaveBeenCalledWith(
    expect.objectContaining({ name: '추가한 워크' }),
    undefined,
  );
  expect(window.location.hash).toBe('#/presets/works');
  expect(trigger).toHaveFocus();
  await waitFor(() => expect(listWorks).toHaveBeenCalledTimes(2));
});

it('replaces the removed schedule management page with the calendar', async () => {
  window.history.replaceState(null, '', '#/schedules');
  render(<App />);
  expect(await screen.findByRole('region', { name: '월 캘린더' })).toBeVisible();
  expect(screen.queryByRole('link', { name: '저장된 스케줄 관리' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '저장된 스케줄' })).not.toBeInTheDocument();
  expect(listSchedules).not.toHaveBeenCalled();
});

describe('app settings', () => {
  it.each([
    ['/today', '당일 요약'],
    ['/calendar', '전체 캘린더'],
    ['/presets/works', '프리셋 설정'],
  ])('clears navigation selection and returns to the same %s destination', async (path, name) => {
    window.history.replaceState(null, '', '#' + path);
    render(<App />);
    await waitFor(() => expect(bootstrapSettings).toHaveBeenCalled());
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    expect(document.querySelector('.workspace-sidebar [aria-current]')).toBeNull();
    // Keep jsdom's deferred anchor navigation from leaking into the next test.
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(link);
    expect(screen.queryByRole('heading', { name: '설정' })).not.toBeInTheDocument();
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).toBe('#' + path);
    expect(screen.getByRole('main')).toBeVisible();
  });
  it('switches tabs and restores the previous screen and unsaved input on close', async () => {
    window.history.replaceState(null, '', '#/presets/works');
    vi.mocked(getWork).mockResolvedValue(work);
    render(<App />);
    fireEvent.change(await screen.findByRole('searchbox', { name: '워크 검색' }), {
      target: { value: '작성 중 이름' },
    });
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    expect(screen.getByRole('heading', { name: '설정' })).toHaveFocus();
    expect(screen.queryByRole('searchbox', { name: '워크 검색' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '화면' }));
    expect(screen.getByRole('tabpanel', { name: '화면' })).toBeVisible();
    fireEvent.keyDown(screen.getByRole('tab', { name: '화면' }), { key: 'ArrowUp' });
    expect(screen.getByRole('tab', { name: '일반' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: '일반' })).toBeVisible();
    expect(within(screen.getByRole('tabpanel')).queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '설정 닫기' }));
    expect(screen.getByRole('searchbox', { name: '워크 검색' })).toHaveValue('작성 중 이름');
    await waitFor(() => expect(screen.getByRole('button', { name: '설정' })).toHaveFocus());
    expect(saveWork).not.toHaveBeenCalled();
  });
});

describe('unified edit dialogs', () => {
  const scheduled: ScheduleDetail = {
    id: 'schedule-edit',
    entity_id: work.id,
    entity_snapshot: work,
    title: work.name,
    scheduled_date: '2026-09-25',
    end_date: '2026-09-26',
    start_time: '23:00',
    end_time: '01:00',
    time_zone: 'Asia/Tokyo',
    notes: '',
    status: 'planned',
    tasks: [],
    created_at: '',
    updated_at: '',
  };
  it.each(['', '/edit'])(
    'opens direct schedule%s URLs as the same editor with a dial',
    async (suffix) => {
      window.history.replaceState(null, '', '#/schedules/schedule-edit' + suffix);
      vi.mocked(getSchedule).mockResolvedValue(scheduled);
      render(<App />);
      const dialog = await screen.findByRole('dialog', { name: '스케줄 수정' });
      expect(await within(dialog).findByRole('slider', { name: '시작 시간' })).toHaveAttribute(
        'aria-valuetext',
        '23:00',
      );
      expect(within(dialog).getByLabelText('종료 날짜')).toHaveValue('2026-09-26');
      fireEvent.click(within(dialog).getByRole('button', { name: '상세 닫기' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(window.location.hash).toBe('#/today');
      expect(screen.getByRole('heading', { name: '오늘' })).toBeVisible();
    },
  );
  it('edits over Today, retains failed input and refreshes the schedule after saving', async () => {
    window.history.replaceState(null, '', '#/today');
    vi.mocked(getDaySchedules).mockResolvedValue([scheduled]);
    vi.mocked(getSchedule).mockResolvedValue(scheduled);
    vi.mocked(saveSchedule)
      .mockRejectedValueOnce(new Error('편집 실패'))
      .mockResolvedValueOnce(scheduled);
    render(<App />);
    const card = await screen.findByRole('article', { name: work.name });
    fireEvent.click(within(card).getByRole('button', { name: work.name }));
    const trigger = within(card).getByRole('link', { name: '수정' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '스케줄 수정' });
    const start = await within(dialog).findByRole('slider', { name: '시작 시간' });
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    expect(window.location.hash).toBe('#/today');
    fireEvent.click(within(dialog).getByRole('button', { name: '스케줄 저장' }));
    expect(await within(dialog).findByText('편집 실패')).toBeVisible();
    expect(start).toHaveAttribute('aria-valuetext', '23:05');
    fireEvent.click(within(dialog).getByRole('button', { name: '스케줄 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saveSchedule).toHaveBeenLastCalledWith(
      expect.objectContaining({ start_time: '23:05', end_date: '2026-09-26' }),
      'schedule-edit',
    );
    expect(vi.mocked(saveSchedule).mock.calls[1]![0]).not.toHaveProperty('notes');
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(getDaySchedules).toHaveBeenCalledTimes(2));
  });
});
