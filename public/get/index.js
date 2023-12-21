const REPO = 'mytonwalletorg/mytonwallet';
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const LATEST_RELEASE_WEB_URL = `https://github.com/${REPO}/releases/latest`;
const WEB_APP_URL = '/';
const MOBILE_URLS = {
  ios: 'https://apps.apple.com/ru/app/mytonwallet-anyway-ton-wallet/id6464677844',
  android: 'https://play.google.com/store/apps/details?id=org.mytonwallet.app',
};

const platform = getPlatform();
const currentPage = location.href.includes('mac.html')
  ? 'mac'
  : location.href.includes('unsupported.html')
    ? 'unsupported'
    : 'index';

// Request the latest release information from GitHub
const packagesPromise = fetch(LATEST_RELEASE_API_URL)
  .then(response => response.json())
  .then(data => {
    return data.assets.reduce((acc, {
      name,
      browser_download_url,
    }) => {
      let key;

      if (name.endsWith('.exe')) {
        key = 'win';
      } else if (name.endsWith('.AppImage')) {
        key = 'linux';
      } else if (name.endsWith('.dmg')) {
        key = `mac-${name.includes('arm') ? 'arm' : 'x64'}`;
      } else if (name.endsWith('.exe.asc')) {
        key = 'win-signature';
      } else if (name.endsWith('.AppImage.asc')) {
        key = 'linux-signature';
      } else if (name.endsWith('.dmg.asc')) {
        key = `mac-${name.includes('arm') ? 'arm' : 'x64'}-signature`;
      }

      if (key) {
        acc[key] = browser_download_url;
      }

      return acc;
    }, {
      $version: data.name,
    });
  })
  .catch((error) => {
    console.error('Error:', error);
  });

(function init() {
  if (['Windows', 'Linux', 'iOS', 'Android'].includes(platform)) {
    if (currentPage === 'index') {
      setupDownloadButton();
      setupVersion();
    }
  } else if (platform === 'macOS') {
    if (currentPage !== 'mac') {
      redirectToMac();
    } else {
      setupVersion();
    }
  } else if (currentPage !== 'unsupported') {
    redirectToUnsupported();
  }
}());

function getPlatform() {
  const {
    userAgent,
    platform,
  } = window.navigator;

  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  if (
    iosPlatforms.indexOf(platform) !== -1
    // For new IPads with M1 chip and IPadOS platform returns "MacIntel"
    || (platform === 'MacIntel' && ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 2))
  ) {
    return 'iOS';
  }

  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  if (macosPlatforms.indexOf(platform) !== -1) return 'macOS';

  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  if (windowsPlatforms.indexOf(platform) !== -1) return 'Windows';

  if (/Android/.test(userAgent)) return 'Android';

  if (/Linux/.test(platform)) return 'Linux';

  return undefined;
}

function setupDownloadButton() {
  document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.querySelector('.download-btn');
    downloadBtn.innerHTML += ` for ${platform}`;
  });
}

function setupVersion() {
  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([packagesPromise, areSignaturesPresent()]).then(([packages, areSignaturesPresentResult]) => {
      const versionEl = document.querySelector('.version');

      let html = `v. ${packages.$version}`;
      if (['Windows', 'macOS', 'Linux'].includes(platform)) {
        const signaturesHtml = areSignaturesPresentResult
          ? '<a href="javascript:redirectToFullList();">Signatures</a>'
          : '<span class="missing-signatures">Missing signatures!</span>';

        html += ` · ${signaturesHtml}`;
      }

      versionEl.innerHTML = html;
    });
  });
}

function redirectToMac() {
  location.href = './mac.html';
}

function redirectToUnsupported() {
  location.href = './unsupported.html';
}

function redirectToWeb() {
  location.href = WEB_APP_URL;
}

function redirectToFullList() {
  location.href = LATEST_RELEASE_WEB_URL;
}

function redirectToStore(platform) {
  location.href = MOBILE_URLS[platform.toLowerCase()];
}

function downloadDefault() {
  if (platform === 'Windows') {
    download('win');
  } else if (platform === 'Linux') {
    download('linux');
  } else if (platform === 'macOS') {
    redirectToMac();
  } else if (platform === 'iOS' || platform === 'Android') {
    redirectToStore(platform);
  } else {
    redirectToUnsupported();
  }
}

function download(platformKey) {
  packagesPromise.then((packages) => {
    location.href = packages[platformKey];
  });
}

function areSignaturesPresent() {
  return packagesPromise.then((packages) => {
    if (platform === 'Windows') return !!packages['win-signature'];
    if (platform === 'Linux') return !!packages['linux-signature'];
    if (platform === 'macOS') return !!(packages['mac-arm-signature'] && packages['mac-x64-signature']);
  });
}
