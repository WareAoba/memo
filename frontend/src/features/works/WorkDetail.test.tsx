import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkDetail } from './WorkDetail';
import { emptyFields, getWork, saveWork } from '../../api/works';

vi.mock('../../api/works', async (original) => ({
  ...(await original<typeof import('../../api/works')>()),
  getWork: vi.fn(),
  saveWork: vi.fn(),
}));
vi.mock('./WorkTasks', () => ({ WorkTasks: () => null }));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it('edits the work memo from mobile detail and keeps all other preset fields', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const work = {
    ...emptyFields,
    id: 'work',
    name: '영어 학습',
    general_notes: '기존 메모',
    tags: ['학습'],
    created_at: '',
    updated_at: '',
  };
  vi.mocked(getWork).mockResolvedValue(work);
  vi.mocked(saveWork).mockResolvedValue({ ...work, general_notes: '새 메모' });
  render(<WorkDetail id="work" edit={false} modal />);
  fireEvent.change(await screen.findByLabelText('워크 메모'), { target: { value: '새 메모' } });
  fireEvent.blur(screen.getByLabelText('워크 메모'));
  expect(await screen.findByText('메모를 저장했습니다.')).toBeVisible();
  expect(saveWork).toHaveBeenCalledWith({ general_notes: '새 메모' }, 'work');
  expect(screen.getByLabelText('워크 메모')).toHaveValue('새 메모');
  expect(screen.getByLabelText('워크 이름 *')).toHaveValue('영어 학습');
  expect(screen.getByText('학습')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
