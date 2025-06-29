let resolvePromise: NoneToVoidFunction;
const preloadPromise = new Promise<void>((resolve) => {
  resolvePromise = resolve;
});

export function resolveDataPreloadPromise() {
  resolvePromise();
}

export async function waitDataPreload() {
  await preloadPromise;
}
