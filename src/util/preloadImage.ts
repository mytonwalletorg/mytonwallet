export const preloadedImageUrls = new Set();

export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      preloadedImageUrls.add(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}
