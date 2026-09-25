import { afterEach, expect, it, vi } from 'vitest';
import { MemoAutosave, MEMO_DEBOUNCE_MS } from './useMemoAutosave';

afterEach(() => vi.useRealTimers());
it('continues debouncing when typing resumes during an automatic save', async () => {
  vi.useFakeTimers();
  let resolve!: () => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue(undefined);
  const writer = new MemoAutosave('', save);
  writer.change('첫 입력');
  await vi.advanceTimersByTimeAsync(MEMO_DEBOUNCE_MS);
  writer.change('다시 입력 중');
  resolve();
  await vi.advanceTimersByTimeAsync(MEMO_DEBOUNCE_MS - 1);
  expect(save).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenLastCalledWith('다시 입력 중');
  expect(writer.snapshot().dirty).toBe(false);
});
it('debounces rapid typing and saves only the final input without blur', async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue(undefined);
  const writer = new MemoAutosave('', save);
  writer.change('첫');
  await vi.advanceTimersByTimeAsync(400);
  writer.change('첫 번째 기록');
  await vi.advanceTimersByTimeAsync(MEMO_DEBOUNCE_MS - 1);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledExactlyOnceWith('첫 번째 기록');
  expect(writer.snapshot()).toMatchObject({ text: '첫 번째 기록', dirty: false, saved: true });
});

it('serializes edits during a slow request and does not overwrite newer text', async () => {
  let resolve!: (value: string) => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue(undefined);
  const writer = new MemoAutosave('', save);
  writer.change('첫 기록');
  const pending = writer.flush();
  await Promise.resolve();
  writer.change('최신 기록');
  expect(writer.flush()).toBe(pending);
  expect(save).toHaveBeenCalledTimes(1);
  resolve('첫 기록');
  expect(await pending).toBe(true);
  expect(save.mock.calls.map(([text]) => text)).toEqual(['첫 기록', '최신 기록']);
  expect(writer.snapshot()).toMatchObject({ text: '최신 기록', dirty: false });
});

it('saves a revert typed during an in-flight save and retains failed input for retry', async () => {
  let resolve!: () => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    )
    .mockRejectedValueOnce(new Error('오프라인'))
    .mockResolvedValue(undefined);
  const writer = new MemoAutosave('원본', save);
  writer.change('수정');
  const pending = writer.flush();
  await Promise.resolve();
  writer.change('원본');
  resolve();
  expect(await pending).toBe(false);
  expect(writer.snapshot()).toMatchObject({ text: '원본', dirty: true, error: '오프라인' });
  expect(await writer.flush()).toBe(true);
  expect(save).toHaveBeenLastCalledWith('원본');
});

it('saves an empty memo and retries synchronous failures', async () => {
  const save = vi
    .fn()
    .mockImplementationOnce(() => {
      throw new Error('실패');
    })
    .mockResolvedValue('');
  const writer = new MemoAutosave('기존', save);
  writer.change('');
  expect(await writer.flush()).toBe(false);
  expect(await writer.flush()).toBe(true);
  expect(save).toHaveBeenCalledTimes(2);
  expect(writer.snapshot()).toMatchObject({ text: '', dirty: false });
});
