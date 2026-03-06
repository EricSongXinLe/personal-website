import { expect, test } from 'vitest';
import { buildJustifiedRows, getTargetRowHeight } from './photoLayout';

const samplePhotos = [
  { id: 'one', width: 600, height: 600 },
  { id: 'two', width: 600, height: 600 },
  { id: 'three', width: 600, height: 600 },
  { id: 'four', width: 600, height: 600 },
];

test('preserves source order and justifies completed rows to the container width', () => {
  const rows = buildJustifiedRows(samplePhotos, 600, 12, 200);
  const flattenedIds = rows.flatMap((row) => row.items.map((item) => item.photo.id));
  const firstRowWidth =
    rows[0].items.reduce((total, item) => total + item.width, 0) + (rows[0].items.length - 1) * 12;

  expect(flattenedIds).toEqual(['one', 'two', 'three', 'four']);
  expect(rows).toHaveLength(2);
  expect(rows[0].isLastRow).toBe(false);
  expect(firstRowWidth).toBeCloseTo(600, 1);
});

test('keeps the final incomplete row left-aligned without stretching it', () => {
  const rows = buildJustifiedRows(samplePhotos, 600, 12, 200);
  const lastRow = rows[1];
  const lastRowWidth =
    lastRow.items.reduce((total, item) => total + item.width, 0) + (lastRow.items.length - 1) * 12;

  expect(lastRow.isLastRow).toBe(true);
  expect(lastRow.items[0].height).toBe(200);
  expect(lastRowWidth).toBeLessThan(600);
});

test('derives row dimensions from photo aspect ratios', () => {
  const rows = buildJustifiedRows(
    [
      { id: 'wide', width: 1200, height: 600 },
      { id: 'square', width: 600, height: 600 },
    ],
    612,
    12,
    200
  );

  expect(rows).toHaveLength(1);
  expect(rows[0].items[0].width).toBeCloseTo(400, 1);
  expect(rows[0].items[1].width).toBeCloseTo(200, 1);
  expect(rows[0].items[0].height).toBeCloseTo(200, 1);
});

test('uses responsive target row heights for desktop tablet and mobile widths', () => {
  expect(getTargetRowHeight(1280)).toBe(260);
  expect(getTargetRowHeight(820)).toBe(210);
  expect(getTargetRowHeight(390)).toBe(150);
});
