import { getIsClipboardReadDenied } from './clipboard';

function mockPermissionQuery(query: () => Promise<{ state: PermissionState }>) {
  Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true });
}

it.each([
  ['denied', true],
  ['prompt', false],
  ['granted', false],
] as const)('treats the %s clipboard permission as denied: %s', async (state, isDenied) => {
  mockPermissionQuery(() => Promise.resolve({ state }));

  expect(await getIsClipboardReadDenied()).toBe(isDenied);
});

it('does not treat an unknown clipboard permission as denied', async () => {
  mockPermissionQuery(() => Promise.reject(new TypeError('Unknown permission')));

  expect(await getIsClipboardReadDenied()).toBe(false);
});
