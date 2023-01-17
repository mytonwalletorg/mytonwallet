import { TELEGRAM_WEB_URL } from '../../config';

export async function doTonMagic(isEnabled: boolean, cb: NoneToVoidFunction) {
  if (!window.location.href.startsWith(TELEGRAM_WEB_URL)) {
    if (window.location.href.startsWith('https://web.telegram.org/k/')) {
      toggleMagicBadge(isEnabled);
    }

    return;
  }

  if (isEnabled) {
    const scriptEl = document.querySelector('script[src^="main."]')!;
    const localRevision = scriptEl.getAttribute('src')!;

    const filesToInjectResponse = await fetch(`https://ton.org/app/magic-sources.json?${Date.now()}`);
    const filesToInject = await filesToInjectResponse.json();
    const magicRevision = filesToInject.find((f: string) => f.startsWith('main.') && f.endsWith('.js'));

    const assetCache = await window.caches.open('tt-assets');
    const cachedResponse = await assetCache.match(localRevision);
    if (cachedResponse) {
      const cachedText = await cachedResponse.text();
      // we leverage the fact that the file has its name as part of the sourcemaps appendix
      const isMagicInjected = cachedText?.endsWith(`${magicRevision}.map`);
      if (isMagicInjected) {
        return;
      }
    }

    addBadge('Loading <b>TON magic</b>...');

    const responses = await Promise.all(filesToInject.map(async (fileName: string) => {
      const res = await fetch(`https://ton.org/app/${fileName}`);

      if (res.status !== 200) {
        throw new Error(`[TON Wallet] Failed to load magic: ${res.statusText}. File: ${fileName}`);
      }

      return [
        fileName,
        new Response(await res.blob(), {
          headers: res.headers,
          status: res.status,
          statusText: res.statusText,
        }),
      ];
    }));

    await Promise.all(responses.map(async ([fileName, response]) => {
      if (fileName.startsWith('main.')) {
        if (fileName.endsWith('.js')) {
          await assetCache.put(`${TELEGRAM_WEB_URL}${localRevision}`, response.clone());
        } else if (fileName.endsWith('.css')) {
          const linkEl = document.querySelector('link[rel=stylesheet]')!;
          const currentCssRevision = linkEl.getAttribute('href');
          await assetCache.put(`${TELEGRAM_WEB_URL}${currentCssRevision}`, response.clone());
        }
      } else {
        await assetCache.put(`${TELEGRAM_WEB_URL}${fileName}`, response.clone());
      }
    }));

    localStorage.setItem('ton:magicRevision', magicRevision);
  } else {
    const prevMagicRevision = localStorage.getItem('ton:magicRevision');
    if (!prevMagicRevision) {
      return;
    }

    localStorage.removeItem('ton:magicRevision');
    await window.caches.delete('tt-assets');
  }

  cb();
}

function toggleMagicBadge(isTurnedOn?: boolean) {
  const columnLeft = document.getElementById('column-left');
  const columnCenter = document.getElementById('column-center');

  if (isTurnedOn) {
    addBadge('Switch to <b>Z version</b> in the menu to take advantage of <b>TON magic</b>.');

    // handle shallow screen layout
    if (columnLeft) {
      columnLeft.style.top = '28px';
    }
    if (columnCenter) {
      columnCenter.style.top = '28px';
    }
  } else {
    const badge = document.getElementById('ton-magic-badge');
    if (badge) {
      badge.remove();
      if (columnLeft) {
        columnLeft.style.top = '';
      }
      if (columnCenter) {
        columnCenter.style.top = '';
      }
    }
  }
}

function addBadge(html: string) {
  const badge = document.createElement('div');
  badge.id = 'ton-magic-badge';
  badge.style.position = 'fixed';
  badge.style.zIndex = '999';
  badge.style.top = '0';
  badge.style.background = '#3390ec';
  badge.style.width = '100%';
  badge.style.height = '28px';
  badge.style.lineHeight = '28px';
  badge.style.textAlign = 'center';
  badge.style.fontSize = '14px';
  badge.style.fontFamily = 'system-ui, -apple-system, "system-ui", "Helvetica Neue", sans-serif';
  badge.style.color = 'white';
  badge.innerHTML = html;
  document.body.prepend(badge);
}
