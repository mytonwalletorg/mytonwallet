import type { RefObject } from '../lib/teact/teact';
import { useLayoutEffect } from '../lib/teact/teact';
import { setExtraStyles } from '../lib/teact/teact-dom';

import type { AppTheme } from '../global/types';

import quantize from '../lib/quantize';
import { euclideanDistance, hex2rgb } from './colors';
import { logDebugError } from './logs';

const COLOR_COUNT = 2;
const QUALITY = 1;

export const ACCENT_COLORS = {
  light: [
    '#31AFC7', '#35C759', '#FF9500', '#FF2C55',
    '#AF52DE', '#5856D7', '#73AAED', '#FFB07A',
    '#B76C78', '#9689D1', '#E572CC', '#6BA07A',
    '#338FCC', '#1FC863', '#929395', '#E4B102',
    '#000000',
  ],
  dark: [
    '#3AB5CC', '#32D74B', '#FF9F0B', '#FF325A',
    '#BF5AF2', '#7977FF', '#73AAED', '#FFB07A',
    '#B76C78', '#9689D1', '#E572CC', '#6BA07A',
    '#338FCC', '#2CD36F', '#C3C5C6', '#DDBA00',
    '#FFFFFF',
  ],
} as const;
export const ACCENT_RADIOACTIVE_INDEX = 13;
export const ACCENT_SILVER_INDEX = 14;
export const ACCENT_GOLD_INDEX = 15;
export const ACCENT_BNW_INDEX = 16;

const HEX_80_PERCENT = 'CC';
const HEX_10_PERCENT = '1A';

export function useAccentColor(
  elementRefOrBody: RefObject | 'body',
  appTheme: AppTheme,
  accentColorIndex: number | undefined,
) {
  const accentColor = accentColorIndex ? ACCENT_COLORS[appTheme][accentColorIndex] : undefined;

  useLayoutEffect(() => {
    const element = elementRefOrBody === 'body' ? document.body : elementRefOrBody.current;
    if (!element) return;

    setExtraStyles(element, {
      '--color-accent': accentColor || 'inherit',
      '--color-accent-10o': accentColor ? `${accentColor}${HEX_10_PERCENT}` : 'inherit',
      '--color-accent-button-background': accentColor || 'inherit',
      '--color-accent-button-background-hover': accentColor ? `${accentColor}${HEX_80_PERCENT}` : 'inherit',
      '--color-accent-button-text': accentColor === '#FFFFFF' ? '#000000' : 'inherit',
      '--color-accent-button-text-hover': accentColor === '#FFFFFF' ? '#000000' : 'inherit',
    });
  }, [elementRefOrBody, accentColor]);
}

export function extractAccentColorIndex(img: HTMLImageElement) {
  try {
    const palette = extractPaletteFromImage(img);
    if (!palette?.length) {
      return undefined;
    }

    const dominantRgb = palette[0];
    const distances = ACCENT_COLORS.light.map((ac) => euclideanDistance(dominantRgb, hex2rgb(ac)));
    const minDistance = Math.min(...distances);
    const index = distances.indexOf(minDistance);

    return index;
  } catch (err) {
    logDebugError('getAccentColorFromImage', err);
    return undefined;
  }
}

function extractPaletteFromImage(img: HTMLImageElement) {
  const imageData = extractImageData(img);
  const pixelArray = createPixelArray(imageData, img.naturalWidth * img.naturalHeight, QUALITY);
  const cmap = quantize(pixelArray, COLOR_COUNT);
  if (!cmap) return undefined;

  const palette = cmap.palette() as [number, number, number][];

  return palette;
}

function extractImageData(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imageData.data;
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
