import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

afterEach(() => vi.unstubAllGlobals());
function Harness() {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button id="menu-expand" onClick={() => setExpanded(true)}>
        확장
      </button>
      <Sidebar
        path="/calendar"
        today="2026-09-24"
        calendarMode="month"
        onCalendarMode={() => {}}
        expanded={expanded}
        onExpanded={setExpanded}
      />
      <main>콘텐츠</main>
    </>
  );
}
it('hides disclosures in the rail and closes only on outside click completes or Escape', () => {
  render(<Harness />);
  expect(screen.queryByRole('button', { name: '캘린더 보기 메뉴' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '확장' }));
  fireEvent.click(screen.getByRole('button', { name: '캘린더 보기 메뉴' }));
  fireEvent.pointerDown(screen.getByRole('link', { name: '월별로 보기' }));
  expect(screen.getByRole('navigation', { name: '캘린더 보기' })).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('main'), { pointerType: 'touch' });
  expect(screen.getByRole('navigation', { name: '캘린더 보기' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('main'));
  expect(screen.queryByRole('navigation', { name: '캘린더 보기' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '확장' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: '캘린더 보기 메뉴' })).not.toBeInTheDocument();
});
it('navigates from the mobile dock without opening duplicate view menus', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(<Harness />);
  fireEvent.click(screen.getByRole('link', { name: '전체 캘린더' }));
  expect(screen.getByRole('link', { name: '전체 캘린더' })).toHaveAttribute('href', '#/calendar');
  expect(screen.queryByRole('navigation', { name: '캘린더 보기' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: '프리셋 설정' }));
  expect(screen.getByRole('link', { name: '프리셋 설정' })).toHaveAttribute(
    'href',
    '#/presets/works',
  );
  expect(screen.queryByRole('navigation', { name: '프리셋 종류' })).not.toBeInTheDocument();
});

it('leaves an open dialog in charge of clicks and Escape', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '확장' }));
  const dialog = document.createElement('dialog');
  dialog.setAttribute('open', '');
  document.body.append(dialog);
  fireEvent.click(dialog);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.getByRole('button', { name: '캘린더 보기 메뉴' })).toBeInTheDocument();
  dialog.remove();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: '캘린더 보기 메뉴' })).not.toBeInTheDocument();
});
