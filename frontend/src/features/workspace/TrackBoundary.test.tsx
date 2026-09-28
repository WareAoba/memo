import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TrackBoundary } from './TrackBoundary';
import { TrackSelector } from './TrackSelector';
import { useTracks } from './trackContext';
import { listTracks, saveTrack } from '../../api/tracks';
import { currentTrackScope, selectTrackScope } from '../../api/trackScope';
import { flushTrackMemos } from '../shared/useMemoAutosave';
vi.mock('../../api/tracks');
vi.mock('../shared/useMemoAutosave', () => ({ flushTrackMemos: vi.fn(async () => true) }));
const tracks = {
  items: [
    { id: 'a', name: '공부' },
    { id: 'b', name: '운동' },
  ],
  limit: 3,
  default_id: 'a',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracks).mockResolvedValue(tracks);
  vi.mocked(flushTrackMemos).mockResolvedValue(true);
  localStorage.clear();
  selectTrackScope('', '');
  window.history.replaceState(null, '', '#/today');
});
function mount() {
  return render(
    <TrackBoundary accountId="user">
      <TestTracks />
    </TrackBoundary>,
  );
}
function TestTracks() {
  const controls = useTracks();
  return (
    <>
      <TrackSelector {...controls} />
      <p data-testid="selected">{controls.track.name}</p>
    </>
  );
}
it('restores selection, switches within this tab, and supports creating and renaming', async () => {
  localStorage.setItem('preset.track.user', 'b');
  mount();
  expect(await screen.findByTestId('selected')).toHaveTextContent('운동');
  fireEvent.click(screen.getByRole('combobox', { name: '트랙 전환' }));
  fireEvent.click(screen.getByRole('option', { name: '공부' }));
  await waitFor(() => expect(currentTrackScope().trackId).toBe('a'));
  expect(localStorage.getItem('preset.track.user')).toBe('a');
  vi.mocked(saveTrack).mockResolvedValue({ id: 'c', name: '업무' });
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: '새 트랙 만들기' }));
  fireEvent.change(screen.getByRole('textbox', { name: '트랙 이름' }), {
    target: { value: '업무' },
  });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByRole('option', { name: '새 트랙 만들기' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: '업무' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: '트랙 이름 변경' }));
  vi.mocked(saveTrack).mockResolvedValue({ id: 'a', name: '시험 공부' });
  fireEvent.change(screen.getByRole('textbox', { name: '트랙 이름' }), {
    target: { value: '시험 공부' },
  });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('시험 공부'));
});
it('keeps the current track when memo saving fails or the leave guard cancels', async () => {
  mount();
  await screen.findByTestId('selected');
  vi.mocked(flushTrackMemos).mockResolvedValue(false);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: '운동' }));
  await screen.findByText('메모를 저장하지 못했습니다. 입력을 확인하고 다시 전환해 주세요.');
  expect(currentTrackScope().trackId).toBe('a');
  vi.mocked(flushTrackMemos).mockResolvedValue(true);
  const cancel = (event: Event) => event.preventDefault();
  window.addEventListener('track-before-switch', cancel);
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: '운동' }));
  await act(async () => {});
  expect(currentTrackScope().trackId).toBe('a');
  window.removeEventListener('track-before-switch', cancel);
});
it('opens an app notification in its owning track and rejects unavailable tracks', async () => {
  mount();
  await screen.findByTestId('selected');
  act(() => {
    window.history.replaceState(null, '', '#/schedules/id?track=b');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await waitFor(() => expect(currentTrackScope().trackId).toBe('b'));
  expect(window.location.hash).toBe('#/schedules/id?track=b');
  act(() => {
    window.history.replaceState(null, '', '#/schedules/id?track=foreign');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await screen.findByText('이 트랙을 찾을 수 없습니다.');
  expect(currentTrackScope().trackId).toBe('b');
});
