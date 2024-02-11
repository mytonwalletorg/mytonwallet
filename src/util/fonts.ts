import { requestMutation } from '../lib/fasterdom/fasterdom';

export function forceLoadFonts() {
  const el = document.createElement('div');
  el.textContent = '₽';
  el.classList.add('visually-hidden');
  document.body.appendChild(el);

  requestMutation(() => {
    document.body.removeChild(el);
  });
}
