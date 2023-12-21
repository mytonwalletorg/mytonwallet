import { IS_IOS } from './windowEnvironment';

const resetScroll = (container: HTMLDivElement, scrollTop?: number) => {
  if (IS_IOS) {
    container.style.overflow = 'hidden';
  }

  if (scrollTop !== undefined) {
    container.scrollTop = scrollTop;
  }

  if (IS_IOS) {
    container.style.overflow = '';
  }
};

export default resetScroll;
