import { Crypto } from '@peculiar/webcrypto';
import { Buffer } from 'buffer/';

require('dotenv')
  .config();

jest.mock('../src/lib/rlottie/RLottie');

Object.assign(global, {
  Buffer,
  crypto: new Crypto(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn()
    .mockImplementation((query) => ({
      matches: false,
      media: query,
      // eslint-disable-next-line no-null/no-null
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
});

Object.defineProperty(global.Element.prototype, 'innerText', {
  get() {
    const el = this.cloneNode(true); // can skip if mutability isn't a concern
    el.querySelectorAll('script,style')
      .forEach((s) => s.remove());
    return el.textContent;
  },
  configurable: true, // make it so that it doesn't blow chunks on re-running tests with things like --watch
});

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: class {
    // eslint-disable-next-line class-methods-use-this
    observe() {
    }

    // eslint-disable-next-line class-methods-use-this
    unobserve() {
    }

    // eslint-disable-next-line class-methods-use-this
    disconnect() {
    }
  },
});

Object.defineProperty(global, 'indexedDB', {
  writable: true,
  configurable: true,
  value: {
    open() {
      return {};
    },
  },
});
