// Converts a string to a numeric seed using a simple hashing algorithm
function stringToNumberSeed(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // hash * 31 + charCode
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    // Conversion to a 32-bit integer
    hash |= 0;
  }

  return hash;
}

export default function getPseudoRandomNumber(min: number, max: number, seed: string) {
  const numberSeed = stringToNumberSeed(seed);
  // Convert `seed` to a pseudorandom number using `Math.sin`
  const x = Math.sin(numberSeed) * 10000;
  const randomFraction = x - Math.floor(x);

  return Math.floor(randomFraction * (max - min + 1)) + min;
}
