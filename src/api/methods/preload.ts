let resolvePromise: Function;
const preloadPromise = new Promise((resolve) => {
  resolvePromise = resolve;
});

export function resolveDataPreloadPromise() {
  resolvePromise();
}

export async function waitDataPreload() {
  await preloadPromise;
}
