export function crc32(data: string): number {
  return crc32FromBytes(Buffer.from(data));
}

export function crc32FromBytes(bytes: Uint8Array): number {
  // The implementation is based on https://stackoverflow.com/a/18639999/1118709
  const crc32Table = makeCrc32Table();
  let crc = 0 ^ -1;

  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ bytes[i]) & 0xFF];
  }

  return (crc ^ -1) >>> 0;
}

let crc32Table: Uint32Array;

function makeCrc32Table() {
  if (!crc32Table) {
    let c: number;
    crc32Table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      }
      crc32Table[n] = c;
    }
  }

  return crc32Table;
}
