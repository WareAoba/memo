import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkEditor } from './works/Works';
import { TaskPresetEditor } from './tasks/TaskPresets';
import { emptyFields as workFields, saveWork } from '../api/works';
import { emptyFields as taskFields, saveTaskPreset } from '../api/taskPresets';

vi.mock('../api/works', async (original) => ({
  ...(await original<typeof import('../api/works')>()),
  saveWork: vi.fn(),
}));
vi.mock('../api/taskPresets', async (original) => ({
  ...(await original<typeof import('../api/taskPresets')>()),
  saveTaskPreset: vi.fn(),
}));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it.each(['work', 'task'])('%s preserves comma tags when editing unrelated fields', async (kind) => {
  const tags = ['고객, VIP', '일반'];
  const work = { ...workFields, name: '대상', tags, id: 'work', created_at: '', updated_at: '' };
  const task = {
    ...taskFields,
    name: '대상',
    tags,
    id: 'task',
    version: 1,
    created_at: '',
    updated_at: '',
  };
  vi.mocked(saveWork).mockResolvedValue(work);
  vi.mocked(saveTaskPreset).mockResolvedValue(task);
  render(
    kind === 'work' ? (
      <WorkEditor initial={work} id="work" />
    ) : (
      <TaskPresetEditor initial={task} id="task" />
    ),
  );
  expect(screen.getByLabelText('태그')).toHaveValue('고객, VIP, 일반');
  expect(screen.getByLabelText('태그').tagName).toBe('INPUT');
  fireEvent.change(screen.getByLabelText(kind === 'work' ? '워크 이름 *' : '태스크 이름 *'), {
    target: { value: '새 이름' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: kind === 'work' ? '워크 저장' : '태스크 저장' }),
  );
  await waitFor(() =>
    expect(kind === 'work' ? saveWork : saveTaskPreset).toHaveBeenCalledWith(
      expect.objectContaining({ name: '새 이름', tags }),
      kind,
    ),
  );
});

it.each(['work', 'task'])(
  '%s delayed save leaves a newer editor and its input intact',
  async (kind) => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.mocked(saveWork).mockImplementation(async () => {
      await pending;
      return { ...workFields, name: 'old', id: 'old', created_at: '', updated_at: '' };
    });
    vi.mocked(saveTaskPreset).mockImplementation(async () => {
      await pending;
      return { ...taskFields, name: 'old', id: 'old', version: 1, created_at: '', updated_at: '' };
    });
    window.history.replaceState(null, '', '#/old');
    const old = render(
      kind === 'work' ? (
        <WorkEditor initial={{ ...workFields, name: 'old' }} />
      ) : (
        <TaskPresetEditor initial={{ ...taskFields, name: 'old' }} />
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: kind === 'work' ? '워크 저장' : '태스크 저장' }),
    );
    old.unmount();
    window.history.replaceState(null, '', '#/presets/works/new');
    render(<WorkEditor initial={workFields} />);
    fireEvent.change(screen.getByLabelText('워크 이름 *'), { target: { value: '작성 중' } });
    await act(async () => {
      finish();
      await pending;
    });
    expect(window.location.hash).toBe('#/presets/works/new');
    expect(screen.getByLabelText('워크 이름 *')).toHaveValue('작성 중');
  },
);

it.each(['work', 'task'])('%s metadata editor does not change archived state', async (kind) => {
  vi.mocked(saveWork).mockResolvedValue({
    ...workFields,
    id: 'w',
    name: 'work',
    created_at: '',
    updated_at: '',
  });
  vi.mocked(saveTaskPreset).mockResolvedValue({
    ...taskFields,
    id: 't',
    name: 'task',
    version: 1,
    created_at: '',
    updated_at: '',
  });
  render(
    kind === 'work' ? (
      <WorkEditor initial={{ ...workFields, name: 'work', archived: true }} id="w" />
    ) : (
      <TaskPresetEditor initial={{ ...taskFields, name: 'task', archived: true }} id="t" />
    ),
  );
  fireEvent.click(
    screen.getByRole('button', { name: kind === 'work' ? '워크 저장' : '태스크 저장' }),
  );
  await waitFor(() => expect(kind === 'work' ? saveWork : saveTaskPreset).toHaveBeenCalled());
  const body =
    kind === 'work'
      ? vi.mocked(saveWork).mock.calls[0]![0]
      : vi.mocked(saveTaskPreset).mock.calls[0]![0];
  expect(body).not.toHaveProperty('archived');
});

it('reuses a kind through an editable dropdown and saves content without a kind', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ['장소', '목표'] }),
  );
  vi.mocked(saveWork).mockResolvedValue({
    ...workFields,
    id: 'w',
    name: '워크',
    created_at: '',
    updated_at: '',
  });
  const done = vi.fn();
  render(<WorkEditor initial={{ ...workFields, name: '워크' }} onDone={done} />);
  expect(screen.getByLabelText('종류')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('종류')).not.toBeRequired();
  fireEvent.change(screen.getByLabelText('내용'), { target: { value: '지하 2층' } });
  fireEvent.click(screen.getByRole('combobox', { name: '종류' }));
  fireEvent.click(await screen.findByRole('option', { name: '장소' }));
  expect(screen.getByLabelText('종류')).toHaveValue('장소');
  expect(screen.getByLabelText('내용')).toHaveValue('지하 2층');
  fireEvent.click(screen.getByRole('button', { name: '정보 추가' }));
  fireEvent.change(screen.getAllByLabelText('내용')[1]!, { target: { value: '종류 없는 메모' } });
  fireEvent.click(screen.getByRole('button', { name: '워크 저장' }));
  await waitFor(() =>
    expect(saveWork).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_fields: [
          { name: '장소', value: '지하 2층' },
          { name: '', value: '종류 없는 메모' },
        ],
      }),
      undefined,
    ),
  );
  await waitFor(() => expect(done).toHaveBeenCalled());
});

it('allows typing only after choosing direct input and locks existing choices', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ['장소'] }));
  render(<WorkEditor initial={workFields} />);
  const kind = screen.getByRole('combobox', { name: '종류' });
  expect(kind).toHaveAttribute('readonly');
  fireEvent.focus(kind);
  await screen.findByRole('option', { name: '장소' });
  fireEvent.keyDown(kind, { key: 'ArrowDown' });
  fireEvent.keyDown(kind, { key: 'ArrowDown' });
  fireEvent.keyDown(kind, { key: 'Enter' });
  expect(kind).toHaveValue('장소');
  expect(kind).toHaveAttribute('readonly');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(kind);
  fireEvent.click(screen.getByRole('option', { name: '직접 입력' }));
  expect(kind).not.toHaveAttribute('readonly');
  expect(kind).toHaveFocus();
  fireEvent.change(kind, { target: { value: '새로운 종류' } });
  expect(kind).toHaveValue('새로운 종류');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.keyDown(kind, { key: 'ArrowDown' });
  fireEvent.keyDown(kind, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(kind).toHaveValue('새로운 종류');
  const toggle = screen.getByRole('button', { name: '기존 종류 목록' });
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('option', { name: '장소' }));
  expect(kind).toHaveValue('장소');
  expect(kind).toHaveAttribute('readonly');
  fireEvent.click(toggle);
  expect(screen.getByRole('listbox')).toHaveAttribute('popover', 'manual');
  fireEvent.keyDown(toggle, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '정보 추가' }));
  expect(screen.getAllByRole('region', { name: /상세 정보 \d/ })).toHaveLength(2);
  expect(screen.getAllByRole('combobox', { name: '종류' })[1]).toHaveValue('');
});
