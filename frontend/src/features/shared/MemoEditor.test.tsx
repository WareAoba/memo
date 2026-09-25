import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MemoEditor } from './MemoEditor';

it('retains a failed draft after leaving a detail view and retries after reopening', async () => {
  const save = vi.fn().mockRejectedValue(new Error('오프라인'));
  const view = render(<MemoEditor draftKey="test:failed-detail" value="원본" onSave={save} />);
  fireEvent.change(screen.getByLabelText('메모'), { target: { value: '잃으면 안 되는 기록' } });
  view.unmount();
  await waitFor(() => expect(save).toHaveBeenCalledWith('잃으면 안 되는 기록'));
  await act(async () => {
    await Promise.resolve();
  });
  save.mockResolvedValue(undefined);
  render(<MemoEditor draftKey="test:failed-detail" value="원본" onSave={save} />);
  expect(screen.getByLabelText('메모')).toHaveValue('잃으면 안 되는 기록');
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
  await screen.findByText('메모를 저장했습니다.');
});

it('edits inline, preserves a failed draft, saves and clears existing notes', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValue(undefined);
  function Detail() {
    const [value, setValue] = useState('기존 기록');
    return (
      <MemoEditor
        value={value}
        label="워크 메모"
        onSave={async (text) => {
          await save(text);
          setValue(text);
        }}
      />
    );
  }
  render(<Detail />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('워크 메모'), { target: { value: '특이사항' } });
  fireEvent.blur(screen.getByLabelText('워크 메모'));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByLabelText('워크 메모')).toHaveValue('특이사항');
  fireEvent.blur(screen.getByLabelText('워크 메모'));
  expect(await screen.findByText('메모를 저장했습니다.')).toBeVisible();
  expect(screen.getByLabelText('워크 메모')).toHaveValue('특이사항');
  fireEvent.change(screen.getByLabelText('워크 메모'), { target: { value: '' } });
  fireEvent.blur(screen.getByLabelText('워크 메모'));
  await screen.findByText('메모를 저장했습니다.');
  expect(save).toHaveBeenLastCalledWith('');
  expect(screen.getByLabelText('워크 메모')).toHaveValue('');
});
