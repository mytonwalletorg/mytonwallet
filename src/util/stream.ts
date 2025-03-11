export function transformBytesByStream(input: BufferSource, stream: GenericTransformStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(input);
  void writer.close();

  return readBytesFromStream(stream.readable);
}

/**
 * Reads the whole readable binary stream into a Uint8Array
 */
async function readBytesFromStream(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const output: Uint8Array[] = [];
  let totalSize = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    output.push(value);
    totalSize += value.byteLength;
  }

  if (output.length === 1) {
    return output[0];
  }

  const concatenated = new Uint8Array(totalSize);
  let offset = 0;
  for (const array of output) {
    concatenated.set(array, offset);
    offset += array.byteLength;
  }
  return concatenated;
}
