import { ungzip } from './compression';

const gzipExamples = [
  {
    decompressed: 'Hello, world',
    compressedBase64: 'H4sIAAAAAAAAA/NIzcnJ11Eozy/KSQEAwqma5wwAAAA=',
  },
  {
    decompressed: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce pretium magna pellentesque dui'
      + ' volutpat consectetur. Fusce ultricies commodo augue sit amet rutrum. Maecenas convallis bibendum facilisis.'
      + ' Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Orci varius'
      + ' natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec blandit euismod velit.'
      + ' Donec lacinia ultricies justo in scelerisque. Aenean imperdiet elementum mauris, in tincidunt arcu posuere'
      + ' non. Phasellus sed turpis vitae eros aliquam lacinia a vel nisi. Ut aliquet a ligula nec placerat. In'
      + ' tincidunt et quam ut pellentesque. Proin ut sodales elit, sit amet fermentum nibh.',
    compressedBase64:
      'H4sIAAAAAAAAA1WSSY4UMRBFrxIHaOUFWCEhJCQQbGAfaUdXB/LUMdT5+a7qiUXKqRjf//b3adJJl2enOts0cg3iLvFAZQ6XEhJpxFWXetFxIWka'
      + 'B31NL0LLJBStnS+DaUlrMkL8OYVqKl1ny1gcH0e9tmYL06LiSPY+6yTOC/pe95NlWPaDfrAUGbzrxpVbU6dTTxkVex+5KALqB/0RDz2zIcpgeN'
      + 'G0TDsadKA0C/JO04pSyxL4x5o7BzDW9BQTKnliJuM0lk/0c5df2RTlg2NubQs8cRuGAVs7VlR8iw0KFR5Qn9uIB7RA7HbQtGoBnlNP4H6ZQwqd'
      + 'jUeFYEl1eEDXu7n3ZIO4AZB3p/6mx9xiMLOJ6Tb6oM8yhAdpX2JVQYRcB8PtXoADCrSEjqI1gcZW8k3tmOOgX0/suDuwuVQCLe6arhosJDaduO'
      + 'lzcn8j4g1KUK0H/Y57GnuZml6yMW36hWIxhppvH5ej7DYq47/nAgaboETYZ+UGsduKh/fn8Cj2Imro+XT8A19weqe5AgAA',
  },
];

describe('ungzip', () => {
  describe.each(gzipExamples)('example %#', ({ compressedBase64, decompressed }) => {
    const compressed = Buffer.from(compressedBase64, 'base64');

    it('decompresses natively', async () => {
      expect(typeof DecompressionStream).toBe('function'); // Tests the test itself
      expect(bytesToString(await ungzip(compressed))).toEqual(decompressed);
    });

    it('decompresses when the native compression API is unsupported', async () => {
      await withUnavailableNativeApi(async () => {
        expect(bytesToString(await ungzip(compressed))).toEqual(decompressed);
      });
    });
  });
});

function bytesToString(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

async function withUnavailableNativeApi<T>(action: () => (Promise<T> | T)) {
  const originalCompressionStream = Object.getOwnPropertyDescriptor(global, 'CompressionStream');
  const originalDecompressionStream = Object.getOwnPropertyDescriptor(global, 'DecompressionStream');

  delete (global as any).CompressionStream;
  delete (global as any).DecompressionStream;

  try {
    return await action();
  } finally {
    if (originalCompressionStream) Object.defineProperty(global, 'CompressionStream', originalCompressionStream);
    if (originalDecompressionStream) Object.defineProperty(global, 'DecompressionStream', originalDecompressionStream);
  }
}
