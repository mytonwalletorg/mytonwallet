let resolveRenderPromise: Function;
const renderPromise = new Promise((resolve) => {
  resolveRenderPromise = resolve;
});

export function resolveRender() {
  resolveRenderPromise();
}

export function waitRender() {
  return renderPromise;
}
