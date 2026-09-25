import { afterEach, expect, it, vi } from 'vitest';
import { uploadPhoto } from './photos';
afterEach(() => vi.unstubAllGlobals());
it.each([
  [429, '처리 중'],
  [507, '저장 한도'],
])('explains upload capacity errors (%s)', async (status, message) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
  await expect(
    uploadPhoto({ type: 'task', id: 't' }, new File(['png'], 'photo.png', { type: 'image/png' })),
  ).rejects.toThrow(message);
});
it('rejects documents and oversized photos before requesting upload', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    uploadPhoto(
      { type: 'task', id: 't' },
      new File(['%PDF'], 'file.pdf', { type: 'application/pdf' }),
    ),
  ).rejects.toThrow('사진만');
  await expect(
    uploadPhoto(
      { type: 'task', id: 't' },
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'photo.png', { type: 'image/png' }),
    ),
  ).rejects.toThrow('10MiB');
  expect(fetcher).not.toHaveBeenCalled();
});
