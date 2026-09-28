import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import * as schedules from '../../api/schedules';
import { ScheduleContextColor } from '../schedules/ScheduleContextColor';
import type { ScheduleColor } from '../../api/scheduleColors';
import { afterEach, expect, it, vi } from 'vitest';
import { ContentContextMenu } from './ContentContextMenu';
import { Button, Input } from './ui';
import { DeleteButton } from './SwipeDelete';
import { ScheduleCardActions } from './ScheduleCardActions';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('changes color inline through the existing API, preserves errors for retry, and does not open the source', async () => {
  const open = vi.fn();
  const save = vi
    .spyOn(schedules, 'saveSchedule')
    .mockRejectedValueOnce(new Error('Color failed'))
    .mockResolvedValue({ color: 'blue' } as schedules.ScheduleDetail);
  function Card() {
    const [color, setColor] = useState<ScheduleColor>('red');
    return (
      <article data-context-content data-testid="color-card" onClick={open}>
        <ScheduleContextColor id="s" color={color} onSaved={(value) => setColor(value.color!)} />
        <Button data-context-action="edit">Edit</Button>
      </article>
    );
  }
  render(
    <>
      <ContentContextMenu />
      <Card />
    </>,
  );
  fireEvent.contextMenu(screen.getByTestId('color-card'), { clientX: 100, clientY: 100 });
  const menu = screen.getByRole('menu');
  expect(menu.firstElementChild).toContainElement(screen.getByRole('group'));
  expect(within(menu).queryByText('콘텐츠 메뉴')).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '빨강' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: '파랑' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Color failed');
  expect(screen.getByRole('radio', { name: '빨강' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: '파랑' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: '파랑' })).toBeChecked());
  expect(save).toHaveBeenLastCalledWith({ color: 'blue' }, 's');
  expect(open).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('radio', { name: '파랑' }), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('uses only the nearest explicitly registered content and invokes the existing action once', () => {
  const edit = vi.fn();
  render(
    <>
      <ContentContextMenu />
      <article data-context-content data-testid="parent">
        <Button data-context-action="edit">Parent edit</Button>
        <section data-context-content data-testid="child">
          <Button data-context-action="edit" onClick={edit}>
            Task edit
          </Button>
        </section>
      </article>
    </>,
  );
  fireEvent.contextMenu(screen.getByTestId('child'), { clientX: 100, clientY: 100 });
  const menu = screen.getByRole('menu');
  expect(within(menu).queryByText('Parent edit')).not.toBeInTheDocument();
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Task edit' }));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('preserves existing delete confirmation and never executes deletion on opening', async () => {
  const remove = vi.fn().mockResolvedValue(undefined);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(
    <>
      <ContentContextMenu />
      <article data-context-content data-testid="card">
        <DeleteButton label="Example" onDelete={remove} />
      </article>
    </>,
  );
  fireEvent.contextMenu(screen.getByTestId('card'));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem'));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
});

it('blocks unspecified areas, editable fields and middle click without blocking wheel scrolling', () => {
  render(
    <>
      <ContentContextMenu />
      <div data-testid="blank">Blank</div>
      <article data-context-content>
        <Input aria-label="Draft" />
        <Button data-context-action="edit">Edit</Button>
      </article>
    </>,
  );
  const blank = screen.getByTestId('blank');
  expect(fireEvent.contextMenu(blank)).toBe(false);
  expect(fireEvent.contextMenu(screen.getByRole('textbox'))).toBe(false);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(fireEvent.mouseDown(blank, { button: 1 })).toBe(false);
  expect(
    fireEvent(blank, new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true })),
  ).toBe(false);
  expect(fireEvent.wheel(blank, { deltaY: 20 })).toBe(true);
});

it('provides keyboard navigation, focus restoration and excludes disabled controls', () => {
  render(
    <>
      <ContentContextMenu />
      <article data-context-content>
        <Button data-context-action="edit">First</Button>
        <Button data-context-action="memo">Second</Button>
        <Button data-context-action="trash" disabled>
          Unavailable
        </Button>
      </article>
    </>,
  );
  const first = screen.getByText('First');
  first.focus();
  fireEvent.keyDown(first, { key: 'F10', shiftKey: true });
  expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(first).toHaveFocus();
});

function pointer(target: Element, type: string, x = 20, y = 20) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  fireEvent(target, event);
}

it('opens on a stationary touch, cancels for movement and suppresses the release click', () => {
  vi.useFakeTimers();
  const click = vi.fn();
  render(
    <>
      <ContentContextMenu />
      <article data-context-content data-testid="card" onClick={click}>
        <Button data-context-action="edit">Edit</Button>
      </article>
    </>,
  );
  const card = screen.getByTestId('card');
  pointer(card, 'pointerdown');
  pointer(card, 'pointermove', 40);
  act(() => vi.advanceTimersByTime(600));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  pointer(card, 'pointerdown');
  act(() => vi.advanceTimersByTime(550));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(3000));
  pointer(card, 'pointerup');
  fireEvent.click(card, { detail: 1 });
  expect(click).not.toHaveBeenCalled();
});

it('shows a failed deletion on the content even when the original shortcut is hidden', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(
    <>
      <ContentContextMenu />
      <article data-context-content data-testid="card">
        <div hidden>
          <DeleteButton
            label="Example"
            onDelete={async () => {
              throw new Error('Delete failed');
            }}
          />
        </div>
      </article>
    </>,
  );
  fireEvent.contextMenu(screen.getByTestId('card'));
  fireEvent.click(screen.getByRole('menuitem'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed');
  expect(screen.getByTestId('card')).toBeInTheDocument();
});

it('exposes existing schedule shortcuts on mobile without displaying hover buttons', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(
    <>
      <ContentContextMenu />
      <article data-context-content data-testid="card">
        <ScheduleCardActions id="s" label="Example" value="" onSave={vi.fn()} />
      </article>
    </>,
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.contextMenu(screen.getByTestId('card'));
  expect(screen.getByRole('menuitem', { name: '스티커 메모로 표시' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: '스케줄 구분색' })).toBeInTheDocument();
  expect(screen.getAllByRole('radio')).toHaveLength(8);
  expect(screen.getByRole('menuitem', { name: '메모 추가·수정…' })).toBeInTheDocument();
});
