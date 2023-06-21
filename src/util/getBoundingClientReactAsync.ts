export default function getBoundingClientRectsAsync(element: Element) {
  return new Promise<DOMRectReadOnly>((resolve) => {
    const observer = new IntersectionObserver((entries, ob) => {
      ob.disconnect();

      resolve(entries[0]?.boundingClientRect);
    });

    observer.observe(element);
  });
}
