import { summarizeSamples } from './summary';

test('computes avg (rounded) and max heart rate', () => {
  const r = summarizeSamples([60, 80, 100], []);
  expect(r.avgHeartRate).toBe(80);
  expect(r.maxHeartRate).toBe(100);
  expect(r.activeCalories).toBe(null);
});

test('sums active calories (rounded)', () => {
  const r = summarizeSamples([], [12.4, 30.1, 7.5]);
  expect(r.activeCalories).toBe(50);
  expect(r.avgHeartRate).toBe(null);
  expect(r.maxHeartRate).toBe(null);
});

test('empty input yields all nulls', () => {
  expect(summarizeSamples([], [])).toEqual({
    avgHeartRate: null, maxHeartRate: null, activeCalories: null,
  });
});
