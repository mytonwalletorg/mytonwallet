import isEmptyObject, { isKeyCountGreater } from './isEmptyObject';

describe('isEmptyObject', () => {
  test('empty object', () => {
    expect(isEmptyObject({})).toBe(true);
  });

  test('filled object', () => {
    expect(isEmptyObject({ foo: 'ber' })).toBe(false);
  });

  test('only not own keys', () => {
    const prototype = { foo: 'bar' };
    const object = {};
    Object.setPrototypeOf(object, prototype);
    expect(isEmptyObject(object)).toBe(true);
  });
});

describe('isKeyCountGreater', () => {
  test('empty object', () => {
    const object = {};
    expect(isKeyCountGreater(object, -1)).toBe(true);
    expect(isKeyCountGreater(object, 0)).toBe(false);
    expect(isKeyCountGreater(object, 5)).toBe(false);
  });

  test('object with 3 keys', () => {
    const object = { foo: 1, bar: 2, baz: 3 };
    expect(isKeyCountGreater(object, 0)).toBe(true);
    expect(isKeyCountGreater(object, 2)).toBe(true);
    expect(isKeyCountGreater(object, 3)).toBe(false);
    expect(isKeyCountGreater(object, 6)).toBe(false);
  });

  test('object with not own keys', () => {
    const prototype = { foo: 1 };
    const object = { bar: 2, baz: 3, baq: 4, bat: 5 };
    Object.setPrototypeOf(object, prototype);
    expect(isKeyCountGreater(object, 3)).toBe(true);
    expect(isKeyCountGreater(object, 4)).toBe(false);
  });
});
