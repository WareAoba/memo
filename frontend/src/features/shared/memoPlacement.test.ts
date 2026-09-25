import { expect, it } from 'vitest';
import { memoPlacement } from './memoPlacement';

const viewport = { width: 1000, height: 800 };
const size = { width: 360, height: 300 };
it('anchors the top right by default and flips independently at each edge', () => {
  expect(
    memoPlacement({ left: 700, right: 732, top: 100, bottom: 132 }, size, viewport),
  ).toMatchObject({ left: 356, top: 116, corner: 'top-right' });
  expect(
    memoPlacement({ left: 20, right: 52, top: 100, bottom: 132 }, size, viewport),
  ).toMatchObject({ left: 36, top: 116, corner: 'top-left' });
  expect(
    memoPlacement({ left: 700, right: 732, top: 700, bottom: 732 }, size, viewport),
  ).toMatchObject({ left: 356, top: 416, corner: 'bottom-right' });
  expect(
    memoPlacement({ left: 20, right: 52, top: 700, bottom: 732 }, size, viewport),
  ).toMatchObject({ left: 36, top: 416, corner: 'bottom-left' });
});

it('honors a preferred corner and limits tall content to available space', () => {
  expect(
    memoPlacement(
      { left: 400, right: 432, top: 400, bottom: 432 },
      { width: 360, height: 100 },
      viewport,
      'bottom-left',
    ),
  ).toMatchObject({ left: 416, top: 316, corner: 'bottom-left' });
  const position = memoPlacement(
    { left: 400, right: 432, top: 400, bottom: 432 },
    { width: 360, height: 1000 },
    viewport,
  );
  expect(position).toMatchObject({ top: 12, maxHeight: 404, corner: 'bottom-right' });
});

it('stays inside an offset visual viewport', () => {
  const position = memoPlacement({ left: 105, right: 137, top: 100, bottom: 132 }, size, {
    width: 300,
    height: 600,
    left: 100,
    top: 40,
  });
  expect(position).toMatchObject({ left: 121, top: 116, width: 267, maxHeight: 512 });
});
