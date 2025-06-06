import 'dotenv/config';

import { Crypto } from '@peculiar/webcrypto';
import { Buffer } from 'buffer/';
import { CompressionStream, DecompressionStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';

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
  get(this: Element) {
    const el = this.cloneNode(true) as typeof this; // can skip if mutability isn't a concern
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
    observe() {
    }

    unobserve() {
    }

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

// These APIs are available in the Node.js global scope, but JSDOM removes them, so we need to retrieve them
Object.assign(global, {
  TextEncoder,
  TextDecoder,
  CompressionStream,
  DecompressionStream,
});

// Importing dynamically, because the file execution fails without the above mocks
void import('./initGlobal');
