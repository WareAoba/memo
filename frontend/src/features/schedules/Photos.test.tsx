import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Photos } from './Photos';
import { deletePhoto, listPhotos, uploadPhoto } from '../../api/photos';
vi.mock('../../api/photos', async (original) => ({
  ...(await original<typeof import('../../api/photos')>()),
  listPhotos: vi.fn(),
  uploadPhoto: vi.fn(),
  deletePhoto: vi.fn(),
}));
const target = { type: 'schedule' as const, id: 's' };
const photo = { id: 'p', filename: 'photo.png', mime_type: 'image/png', size_bytes: 100 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listPhotos).mockResolvedValue([]);
});
async function open() {
  fireEvent.click(screen.getByText('사진 (선택)'));
  await screen.findByText(
    '필요한 사진만 추가하세요. JPEG·PNG·WebP, 사진당 최대 10MiB, 최대 100장.',
  );
}
it('loads photos only when opened and retains a selected photo after failed upload', async () => {
  vi.mocked(uploadPhoto).mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValueOnce(photo);
  render(<Photos target={target} locked={false} />);
  expect(listPhotos).not.toHaveBeenCalled();
  await open();
  const input = await screen.findByLabelText('추가할 사진');
  const file = new File(['photo'], 'photo.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: '사진 추가' }));
  expect(await screen.findByText('저장 실패')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '사진 추가' }));
  expect(await screen.findByAltText('photo.png')).toHaveAttribute('src', '/api/photos/p');
  expect(uploadPhoto).toHaveBeenLastCalledWith(target, file);
});
it('requires deletion confirmation and removes the photo after server success', async () => {
  vi.mocked(listPhotos).mockResolvedValue([photo]);
  vi.mocked(deletePhoto).mockRejectedValueOnce(new Error('삭제 실패')).mockResolvedValueOnce();
  render(<Photos target={target} locked={false} />);
  await open();
  fireEvent.click(await screen.findByRole('button', { name: '사진 삭제' }));
  expect(deletePhoto).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }));
  expect(await screen.findByText('삭제 실패')).toBeInTheDocument();
  expect(screen.getByAltText('photo.png')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }));
  await waitFor(() => expect(screen.queryByAltText('photo.png')).not.toBeInTheDocument());
});
it('allows viewing locked photos and retrying failed list loads', async () => {
  vi.mocked(listPhotos)
    .mockRejectedValueOnce(new Error('조회 실패'))
    .mockResolvedValueOnce([photo]);
  render(<Photos target={target} locked />);
  await open();
  expect(await screen.findByText('조회 실패')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByAltText('photo.png')).toBeInTheDocument();
  expect(screen.queryByLabelText('추가할 사진')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '사진 삭제' })).not.toBeInTheDocument();
});

it('keeps an in-flight upload attached while its disclosure is collapsed', async () => {
  let finish!: (value: typeof photo) => void;
  vi.mocked(uploadPhoto).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Photos target={target} locked={false} />);
  await open();
  fireEvent.change(await screen.findByLabelText('추가할 사진'), {
    target: { files: [new File(['test'], 'photo.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: '사진 추가' }));
  fireEvent.click(screen.getByText('사진 (선택)'));
  await act(async () => {
    finish(photo);
  });
  fireEvent.click(screen.getByText('사진 (선택)'));
  expect(await screen.findByAltText('photo.png')).toBeInTheDocument();
  expect(listPhotos).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '사진 추가' })).toBeDisabled();
});
