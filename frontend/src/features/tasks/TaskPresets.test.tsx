import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { TaskPresetEditor, TaskPresetDetail, TaskPresetListView } from './TaskPresets';
import {
  archiveTaskPreset,
  emptyFields,
  getTaskPreset,
  listTaskPresets,
  saveTaskPreset,
} from '../../api/taskPresets';
import type { TaskPreset } from '../../api/taskPresets';
vi.mock('../../api/taskPresets', async (original) => ({
  ...(await original<typeof import('../../api/taskPresets')>()),
  archiveTaskPreset: vi.fn(),
  getTaskPreset: vi.fn(),
  listTaskPresets: vi.fn(),
  saveTaskPreset: vi.fn(),
}));
const preset: TaskPreset = {
  ...emptyFields,
  id: 'preset-id',
  name: '단어 복습',
  version: 1,
  created_at: 'now',
  updated_at: 'now',
  items: [
    {
      id: 'item-id',
      position: 0,
      label: '횟수',
      item_type: 'number',
      required: true,
      default_value: 0,
      unit: '회',
    },
  ],
};
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ['학습'] }));
  vi.mocked(listTaskPresets).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
  window.history.replaceState(null, '', '#/presets/tasks');
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it('saves a memo directly in task detail on mobile without opening a popup', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.mocked(getTaskPreset).mockResolvedValue({ ...preset, default_notes: '이전 메모' });
  vi.mocked(saveTaskPreset).mockResolvedValue({ ...preset, default_notes: '오늘의 기록' });
  render(<TaskPresetDetail id={preset.id} edit={false} />);
  expect(await screen.findByLabelText('기본 메모')).toHaveValue('이전 메모');
  fireEvent.change(screen.getByLabelText('기본 메모'), { target: { value: '오늘의 기록' } });
  fireEvent.blur(screen.getByLabelText('기본 메모'));
  expect(await screen.findByText('메모를 저장했습니다.')).toBeVisible();
  expect(saveTaskPreset).toHaveBeenCalledWith({ default_notes: '오늘의 기록' }, preset.id);
  expect(screen.getByLabelText('기본 메모')).toHaveValue('오늘의 기록');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('recovers a failed list and resets pagination on search and archive', async () => {
  vi.mocked(listTaskPresets)
    .mockRejectedValueOnce(new Error('연결 실패'))
    .mockResolvedValue({ items: [{ ...preset, item_count: 1 }], total: 49, offset: 0, limit: 20 });
  render(<TaskPresetListView />);
  expect(await screen.findByText('연결 실패')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('단어 복습')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await waitFor(() =>
    expect(listTaskPresets).toHaveBeenLastCalledWith(
      '',
      false,
      48,
      expect.any(AbortSignal),
      48,
      undefined,
    ),
  );
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '학습' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() =>
    expect(listTaskPresets).toHaveBeenLastCalledWith(
      '학습',
      false,
      0,
      expect.any(AbortSignal),
      48,
      undefined,
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: '보관함' }));
  await waitFor(() =>
    expect(listTaskPresets).toHaveBeenLastCalledWith(
      '학습',
      true,
      0,
      expect.any(AbortSignal),
      48,
      undefined,
    ),
  );
});
it('saves a task without details and retains input after failure', async () => {
  vi.mocked(saveTaskPreset)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce(preset);
  render(<TaskPresetEditor />);
  fireEvent.change(screen.getByLabelText('태스크 이름 *'), { target: { value: '복습' } });
  expect(screen.getByRole('button', { name: '+ 항목 추가' })).toBeEnabled();
  const group = screen.getByRole('combobox', { name: '태스크 그룹' });
  expect(group).toHaveValue('');
  expect(group).toHaveAttribute('readonly');
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  fireEvent.click(group);
  fireEvent.click(await screen.findByRole('option', { name: '학습' }));
  expect(group).toHaveValue('학습');
  fireEvent.click(screen.getByRole('button', { name: '태스크 저장' }));
  expect(await screen.findByText('저장 실패')).toBeInTheDocument();
  expect(screen.getByLabelText('태스크 이름 *')).toHaveValue('복습');
  fireEvent.click(screen.getByRole('button', { name: '태스크 저장' }));
  await waitFor(() => expect(window.location.hash).toBe('#/presets/tasks/preset-id'));
  expect(saveTaskPreset).toHaveBeenLastCalledWith(
    expect.objectContaining({ items: [], group_name: '학습' }),
    undefined,
  );
});
it('preserves existing item ids and sends only writable fields', async () => {
  vi.mocked(saveTaskPreset).mockResolvedValue(preset);
  render(<TaskPresetEditor initial={preset} id={preset.id} />);
  fireEvent.change(screen.getByLabelText('기본 메모'), { target: { value: '수정' } });
  fireEvent.click(screen.getByRole('button', { name: '태스크 저장' }));
  await waitFor(() => expect(saveTaskPreset).toHaveBeenCalled());
  const payload = vi.mocked(saveTaskPreset).mock.calls[0]![0];
  expect(payload).not.toHaveProperty('version');
  expect(payload).not.toHaveProperty('id');
  expect(payload.items?.[0]).toMatchObject({ id: 'item-id', default_value: 0 });
  expect(payload.items?.[0]).not.toHaveProperty('key');
});
it('edits all item types, reorders, deletes and keeps drafts after a failed save', async () => {
  vi.mocked(saveTaskPreset)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce(preset);
  render(<TaskPresetEditor initial={preset} id={preset.id} />);
  fireEvent.click(screen.getByRole('button', { name: '+ 항목 추가' }));
  let second = within(screen.getByRole('group', { name: '항목 2' }));
  fireEvent.change(second.getByLabelText('항목 이름'), { target: { value: '확인' } });
  fireEvent.click(second.getByLabelText('기본값'));
  fireEvent.click(second.getByLabelText('필수'));
  fireEvent.click(screen.getByRole('button', { name: '+ 항목 추가' }));
  const third = within(screen.getByRole('group', { name: '항목 3' }));
  fireEvent.change(third.getByLabelText('항목 이름'), { target: { value: '기록' } });
  fireEvent.change(third.getByLabelText('종류'), { target: { value: 'text' } });
  fireEvent.change(third.getByLabelText('기본값'), { target: { value: '기본 기록' } });
  fireEvent.change(within(screen.getByRole('group', { name: '항목 1' })).getByLabelText('기본값'), {
    target: { value: '0.00' },
  });
  fireEvent.click(screen.getByRole('button', { name: '항목 3 위로' }));
  fireEvent.click(screen.getByRole('button', { name: '태스크 저장' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  second = within(screen.getByRole('group', { name: '항목 2' }));
  expect(second.getByLabelText('기본값')).toHaveValue('기본 기록');
  expect(vi.mocked(saveTaskPreset).mock.calls[0]![0].items).toEqual([
    expect.objectContaining({ id: 'item-id', position: 0, default_value: 0, unit: '회' }),
    expect.objectContaining({
      position: 1,
      label: '기록',
      item_type: 'text',
      default_value: '기본 기록',
    }),
    expect.objectContaining({
      position: 2,
      label: '확인',
      item_type: 'checkbox',
      default_value: true,
      required: true,
    }),
  ]);
  fireEvent.click(screen.getByRole('button', { name: '항목 2 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '태스크 저장' }));
  await waitFor(() => expect(saveTaskPreset).toHaveBeenCalledTimes(2));
  expect(vi.mocked(saveTaskPreset).mock.calls[1]![0].items).toEqual([
    expect.objectContaining({ id: 'item-id', position: 0 }),
    expect.objectContaining({ position: 1, label: '확인', default_value: true }),
  ]);
});

it('clears incompatible defaults and units when changing item type', async () => {
  vi.mocked(saveTaskPreset).mockResolvedValue(preset);
  render(<TaskPresetEditor initial={preset} id={preset.id} />);
  const item = within(screen.getByRole('group', { name: '항목 1' }));
  fireEvent.change(item.getByLabelText('종류'), { target: { value: 'checkbox' } });
  expect(item.getByLabelText('기본값')).not.toBeChecked();
  expect(item.queryByLabelText('단위')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '태스크 저장' }));
  await waitFor(() => expect(saveTaskPreset).toHaveBeenCalled());
  expect(vi.mocked(saveTaskPreset).mock.calls[0]![0].items?.[0]).toMatchObject({
    id: 'item-id',
    item_type: 'checkbox',
    default_value: null,
    unit: '',
  });
});

it('shows saved definitions including zero and required fields', async () => {
  vi.mocked(getTaskPreset).mockResolvedValue(preset);
  render(<TaskPresetDetail id={preset.id} edit={false} />);
  expect(await screen.findByDisplayValue('횟수')).toBeVisible();
  expect(screen.getByLabelText('기본값')).toHaveValue(0);
  expect(screen.getByLabelText('필수')).toBeChecked();
  expect(screen.getByLabelText('단위')).toHaveValue('회');
});
it('archives and restores while showing errors without losing detail', async () => {
  vi.mocked(getTaskPreset).mockResolvedValue(preset);
  vi.mocked(archiveTaskPreset)
    .mockRejectedValueOnce(new Error('보관 실패'))
    .mockResolvedValueOnce();
  vi.mocked(saveTaskPreset).mockResolvedValue({ ...preset, version: 3 });
  render(<TaskPresetDetail id={preset.id} edit={false} />);
  fireEvent.click(await screen.findByRole('button', { name: '태스크 보관' }));
  expect(await screen.findByText('보관 실패')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '태스크 보관' }));
  expect(await screen.findByText('보관된 태스크')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '태스크 복원' }));
  expect(await screen.findByRole('button', { name: '태스크 보관' })).toBeEnabled();
  expect(saveTaskPreset).toHaveBeenCalledWith({ archived: false }, preset.id);
});
it('retries failed detail loading', async () => {
  vi.mocked(getTaskPreset)
    .mockRejectedValueOnce(new Error('조회 실패'))
    .mockResolvedValueOnce(preset);
  render(<TaskPresetDetail id={preset.id} edit={true} />);
  expect(await screen.findByText('조회 실패')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByLabelText('태스크 이름 *')).toHaveValue('단어 복습');
});

it('opens details and edits a group inside the modal without navigating', async () => {
  const show = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: show,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
  vi.mocked(listTaskPresets).mockResolvedValue({
    items: [{ ...preset, group_name: '학습', item_count: 1 }],
    total: 1,
    offset: 0,
    limit: 48,
  });
  vi.mocked(getTaskPreset).mockResolvedValue({ ...preset, group_name: '학습' });
  vi.mocked(saveTaskPreset).mockResolvedValue({ ...preset, group_name: '운동' });
  render(<TaskPresetListView />);
  const trigger = await screen.findByRole('button', { name: '단어 복습' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  expect(show).toHaveBeenCalled();
  await within(dialog).findByLabelText('태스크 이름 *');
  fireEvent.click(within(dialog).getByLabelText('태스크 그룹'));
  fireEvent.click(screen.getByRole('option', { name: '직접 입력' }));
  fireEvent.change(within(dialog).getByLabelText('태스크 그룹'), { target: { value: '운동' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '태스크 저장' }));
  await waitFor(() =>
    expect(saveTaskPreset).toHaveBeenCalledWith(
      expect.objectContaining({ group_name: '운동' }),
      'preset-id',
    ),
  );
  expect(window.location.hash).toBe('#/presets/tasks');
  fireEvent.click(within(dialog).getByRole('button', { name: '상세 닫기' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '단어 복습' })).toHaveFocus();
});
