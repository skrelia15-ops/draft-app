import { pickCoords } from './resolveCoords';

const live = { latitude: 1, longitude: 1 };
const last = { latitude: 2, longitude: 2 };
const fallback = { latitude: 3, longitude: 3 };

test('prefers live coords', () => {
  expect(pickCoords(live, last, fallback)).toEqual(live);
});

test('falls back to last-known when no live fix', () => {
  expect(pickCoords(null, last, fallback)).toEqual(last);
});

test('falls back to default when nothing else', () => {
  expect(pickCoords(null, null, fallback)).toEqual(fallback);
});
