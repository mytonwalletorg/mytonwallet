import { ACCENT_COLORS } from '../../util/accentColor/constants';
import { euclideanDistance, hex2rgb } from '../../util/colors';
import { createPostMessageInterface } from '../../util/createPostMessageInterface';
import { getCachedImageUrl } from '../../util/getCachedImageUrl';
import { logDebugError } from '../../util/logs';
import quantize from '../quantize';

function extractImageData(img: ImageBitmap) {
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

function createPixelArray(imgData: Uint8ClampedArray, pixelCount: number, quality: number) {
  const pixels = imgData;
  const pixelArray = [];

  for (let i = 0, offset, r, g, b, a; i < pixelCount; i += quality) {
    offset = i * 4;
    r = pixels[offset + 0];
    g = pixels[offset + 1];
    b = pixels[offset + 2];
    a = pixels[offset + 3];

    // If pixel is mostly opaque and not white
    if (typeof a === 'undefined' || a >= 125) {
      if (!(r > 250 && g > 250 && b > 250)) {
        pixelArray.push([r, g, b]);
      }
    }
  }

  return pixelArray;
}

function extractPaletteFromImage(img: ImageBitmap, quality: number, colorCount: number) {
  const imageData = extractImageData(img);
  const pixelArray = createPixelArray(imageData, img.width * img.height, quality);
  const cmap = quantize(pixelArray, colorCount);
  return cmap ? cmap.palette() as [number, number, number][] : undefined;
}

async function processNftImage(url: string, quality: number, colorCount: number) {
  let bitmap: ImageBitmap | undefined;

  try {
    const cachedBlobUrl = await getCachedImageUrl(url);
    const response = await fetch(cachedBlobUrl);
    const blob = await response.blob();
    bitmap = await createImageBitmap(blob);

    const palette = extractPaletteFromImage(bitmap, quality, colorCount);
    if (!palette || palette.length === 0) {
      return undefined;
    }

    const dominantRgb = palette[0];
    const distances = ACCENT_COLORS.light.map((accentColor) => euclideanDistance(dominantRgb, hex2rgb(accentColor)));
    const minDistance = Math.min(...distances);
    return distances.indexOf(minDistance);
  } catch (error) {
    logDebugError('[Worker] Error processing NFT image:', error);
    return undefined;
  } finally {
    if (bitmap) {
      bitmap.close();
    }
  }
}

const api = {
  'offscreen-canvas:processNftImage': processNftImage,
};

createPostMessageInterface(api);

export type OffscreenCanvasApi = typeof api;
