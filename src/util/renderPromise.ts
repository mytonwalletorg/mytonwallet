let resolveRenderPromise: NoneToVoidFunction;
const renderPromise = new Promise<void>((resolve) => {
  resolveRenderPromise = resolve;
});

export function resolveRender() {
  resolveRenderPromise();
}

export function waitRender() {
  return renderPromise;
}
