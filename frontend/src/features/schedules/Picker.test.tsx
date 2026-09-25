import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Picker } from './Picker';
import { listWorks, emptyFields } from '../../api/works';
import { listTaskPresets } from '../../api/taskPresets';

vi.mock('../../api/works', async (original) => ({
  ...(await original<typeof import('../../api/works')>()),
  listWorks: vi.fn(),
}));
vi.mock('../../api/taskPresets');
afterEach(() => vi.resetAllMocks());

it.each(['work', 'task'] as const)(
  'keeps a typed %s independent of a matching preset',
  async (kind) => {
    const preset = {
      ...emptyFields,
      id: 'preset',
      created_at: '',
      updated_at: '',
      version: 1,
      item_count: 0,
      name: 'Study',
      general_notes: 'Reference',
      default_notes: 'Reference',
    };
    const page = { items: [preset], total: 1, limit: 20, offset: 0 };
    vi.mocked(listWorks).mockResolvedValue(page);
    vi.mocked(listTaskPresets).mockResolvedValue(page);
    const onPick = vi.fn();
    render(<Picker kind={kind} allowCreate onPick={onPick} />);
    const input = screen.getByRole('textbox');
    expect(listWorks).not.toHaveBeenCalled();
    expect(listTaskPresets).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Study' } });
    await screen.findByRole('button', { name: 'Study 선택' });
    expect(screen.getByText('Reference')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Study 메모' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '“Study” 사용' }));
    expect(onPick).toHaveBeenLastCalledWith({ id: 'name:Study', name: 'Study' });
    fireEvent.change(input, { target: { value: 'Study' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Study 선택' }));
    expect(onPick).toHaveBeenLastCalledWith(preset);
  },
);

it('accepts a name with Enter while suggestions fail and ignores IME confirmation', async () => {
  vi.mocked(listWorks).mockRejectedValue(new Error('조회 실패'));
  const onPick = vi.fn();
  render(<Picker kind="work" allowCreate onPick={onPick} />);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: ' Study ' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(onPick).not.toHaveBeenCalled();
  await screen.findByText('조회 실패');
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onPick).toHaveBeenCalledWith({ id: 'name:Study', name: 'Study' }));
});
