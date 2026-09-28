import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { TimeEndpoint } from './TimeEndpoint';

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('ko');
  });
});
it('puts English prefixes above the time and Korean and Japanese suffixes below', async () => {
  render(
    <TimeEndpoint value="09:00" endpoint="start" labelled onChange={() => {}} onStep={() => {}} />,
  );
  expect(screen.getByText('부터').parentElement).toHaveAttribute('data-label-position', 'after');
  await act(async () => {
    await i18n.changeLanguage('en');
  });
  expect(screen.getByText('From').parentElement).toHaveAttribute('data-label-position', 'before');
  await act(async () => {
    await i18n.changeLanguage('ja');
  });
  expect(screen.getByText('から').parentElement).toHaveAttribute('data-label-position', 'after');
});

it('uses one time trigger: first click expands arrows, second click opens wheels', () => {
  const change = vi.fn();
  render(
    <TimeEndpoint value="09:00" endpoint="start" labelled onChange={change} onStep={() => {}} />,
  );
  const trigger = screen.getByRole('button', { name: '시작 시간' });
  expect(screen.getAllByText('09:00')).toHaveLength(1);
  const box = trigger.closest('.time-endpoint-box')!;
  expect(box).not.toContainElement(screen.getByText('부터'));
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: '시간 늘리기' })).toBeVisible();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByRole('listbox', { name: '시' })).toBeVisible();
});

it('clears a specified time directly from the expanded controls', () => {
  const change = vi.fn();
  render(
    <TimeEndpoint value="09:00" endpoint="start" labelled onChange={change} onStep={() => {}} />,
  );
  fireEvent.click(screen.getByRole('button', { name: '시작 시간' }));
  fireEvent.click(screen.getByRole('button', { name: '시간 지정 해제' }));
  expect(change).toHaveBeenCalledWith('');
});
