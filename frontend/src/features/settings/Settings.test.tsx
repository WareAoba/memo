import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  bootstrapSettings,
  loadSettings,
  patchSettings,
  resetData,
  defaultSettings,
  type UserSettings,
} from '../../api/settings';
import { Settings } from './Settings';
import { SettingsProvider } from './SettingsProvider';
import { TimeDial } from '../schedules/TimeDial';
vi.mock('../../api/settings', async (original) => ({
  ...(await original<typeof import('../../api/settings')>()),
  bootstrapSettings: vi.fn(),
  loadSettings: vi.fn(),
  patchSettings: vi.fn(),
  resetData: vi.fn(),
}));
let saved: UserSettings;
const clockChange = vi.fn();
beforeEach(() => {
  saved = { ...defaultSettings };
  vi.mocked(bootstrapSettings).mockImplementation(async () => saved);
  vi.mocked(loadSettings).mockImplementation(async () => saved);
  vi.mocked(patchSettings).mockImplementation(async (patch) => (saved = { ...saved, ...patch }));
  vi.mocked(resetData).mockResolvedValue();
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function select(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}
async function open() {
  const view = render(
    <SettingsProvider>
      <Settings onClose={() => {}} />
      <TimeDial start="09:00" end="10:00" onChange={clockChange} />
    </SettingsProvider>,
  );
  await screen.findByText('변경 사항은 자동으로 저장되고 바로 적용됩니다.');
  return view;
}
it('loads stored preferences, hot-saves changes and restores them on reconnect', async () => {
  saved = { ...saved, theme: 'dark', accent: 'blue', content_scale: 110 };
  const view = await open();
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.dataset.accent).toBe('blue');
  fireEvent.click(screen.getByRole('tab', { name: '화면' }));
  select('컨텐츠 배율', '125%');
  await waitFor(() => expect(patchSettings).toHaveBeenCalledWith({ content_scale: 125 }));
  await waitFor(() =>
    expect(document.documentElement.style.getPropertyValue('--content-scale')).toBe('1.25'),
  );
  view.unmount();
  await open();
  fireEvent.click(screen.getByRole('tab', { name: '화면' }));
  expect(screen.getByLabelText('컨텐츠 배율')).toHaveValue('125');
});
it('serializes quick changes, keeps failed drafts and retries the latest values', async () => {
  let resolve!: (value: UserSettings) => void;
  vi.mocked(patchSettings)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockRejectedValueOnce(new Error('offline'));
  await open();
  fireEvent.click(screen.getByRole('tab', { name: '화면' }));
  select('테마', '다크');
  select('테마', '화이트');
  select('앱 강조색', '초록');
  expect(patchSettings).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ ...saved, theme: 'dark' }));
  expect(await screen.findByText('offline')).toBeInTheDocument();
  expect(screen.getByLabelText('테마')).toHaveValue('light');
  expect(document.documentElement.dataset.accent).toBe('green');
  fireEvent(window, new Event('focus'));
  expect(loadSettings).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() =>
    expect(patchSettings).toHaveBeenLastCalledWith({ theme: 'light', accent: 'green' }),
  );
  await screen.findByText('변경 사항은 자동으로 저장되고 바로 적용됩니다.');
});
it('hot-loads remote changes on focus and changes keyboard clock steps', async () => {
  await open();
  saved = { ...saved, clock_step: 15, time_zone: 'Pacific/Honolulu', motion: 'none' };
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(screen.getByLabelText('시간대')).toHaveValue('Pacific/Honolulu'));
  await waitFor(() => expect(document.documentElement.dataset.motion).toBe('none'));
  fireEvent.keyDown(screen.getByRole('slider', { name: '시작 시간' }), { key: 'ArrowRight' });
  expect(clockChange).toHaveBeenLastCalledWith({ start: '09:15', end: '10:00' });
  expect(screen.getByText((_, el) => el?.className === 'dial-hint')).toHaveTextContent(
    '손잡이를 드래그하거나 방향키로 15분씩 조정하세요.',
  );
});
it('does not enable settings until loading succeeds and supports retry', async () => {
  vi.mocked(bootstrapSettings).mockRejectedValueOnce(new Error('load failed'));
  render(
    <SettingsProvider>
      <Settings onClose={() => {}} />
    </SettingsProvider>,
  );
  expect(await screen.findByText('load failed')).toBeInTheDocument();
  expect(screen.getByLabelText('언어')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getByLabelText('언어')).toBeEnabled());
});
it('requires explicit reset text and preserves the confirmation after failure', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: '데이터' }));
  fireEvent.click(screen.getByRole('button', { name: '워크 프리셋 초기화' }));
  expect(screen.getByRole('button', { name: '영구 삭제' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('확인 문구'), { target: { value: 'RESET' } });
  vi.mocked(resetData).mockRejectedValueOnce(new Error('reset failed'));
  fireEvent.click(screen.getByRole('button', { name: '영구 삭제' }));
  expect(await screen.findByText('reset failed')).toBeInTheDocument();
  expect(screen.getByLabelText('확인 문구')).toHaveValue('RESET');
  fireEvent.click(screen.getByRole('button', { name: '영구 삭제' }));
  expect(await screen.findByText('선택한 데이터가 초기화되었습니다.')).toBeInTheDocument();
  expect(resetData).toHaveBeenLastCalledWith('works');
});

it('tracks system color and motion preferences while explicit choices take precedence', async () => {
  const dark = Object.assign(new EventTarget(), { matches: false });
  const motion = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', (query: string) => (query.includes('color-scheme') ? dark : motion));
  await open();
  await act(async () => {
    dark.matches = true;
    motion.matches = true;
    dark.dispatchEvent(new Event('change'));
    motion.dispatchEvent(new Event('change'));
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.dataset.motion).toBe('reduced');
  fireEvent.click(screen.getByRole('tab', { name: '화면' }));
  select('테마', '화이트');
  select('애니메이션', '비활성화');
  await waitFor(() => expect(document.documentElement.dataset.motion).toBe('none'));
  await act(async () => {
    dark.dispatchEvent(new Event('change'));
    motion.dispatchEvent(new Event('change'));
  });
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(document.documentElement.dataset.motion).toBe('none');
});
