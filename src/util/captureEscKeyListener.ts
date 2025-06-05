import captureKeyboardListener from './captureKeyboardListeners';

export default function captureEscKeyListener(handler: NoneToVoidFunction) {
  return captureKeyboardListener({
    onEsc: () => {
      handler();
    },
  });
}
