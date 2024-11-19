const REPO = 'mytonwalletorg/mytonwallet';
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const LATEST_RELEASE_WEB_URL = `https://github.com/${REPO}/releases/latest`;
const LATEST_RELEASE_DOWNLOAD_URL = `https://github.com/${REPO}/releases/download/v%VERSION%`;
const WEB_APP_URL = '/';
const MOBILE_URLS = {
  ios: '/ios',
  android: '/android-store',
  androidDirect: `${LATEST_RELEASE_DOWNLOAD_URL}/MyTonWallet.apk`,
};

let platform = getPlatform();
const currentPage = location.href.includes('/android')
  ? 'android'
  : location.href.includes('/mac')
    ? 'mac'
    : location.href.includes('/rate')
      ? 'rate'
      : location.href.includes('/mobile')
        ? 'mobile'
        : location.href.includes('/desktop')
          ? 'desktop'
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

const IS_DESKTOP = ['Windows', 'Linux', 'macOS'].includes(platform);
const IS_MOBILE = !IS_DESKTOP;

(function init() {
  if (currentPage === 'rate') {
    setupRateButtons();
    return;
  }

  // Handling subpages /get/desktop and /get/mobile
  const isTargetPlatform = (currentPage === 'mobile' && IS_MOBILE) || (currentPage === 'desktop' && IS_DESKTOP);
  if (isTargetPlatform) {
    // If we are on the target platform, redirect to the universal page
    redirectToUniversalPage();
    return;
  }
  if (currentPage === 'mobile') {
    // Version is only needed for /get/mobile
    setupVersion();
  }

  if (currentPage === 'index') {
    if (['Windows', 'Linux', 'iOS'].includes(platform)) {
      setupDownloadButton();
    } else if (platform === 'Android') {
      redirectToAndroid();
    } else if (platform === 'macOS') {
      redirectToMac();
    }
  }

  setupVersion();
}());

function $(id) {
  return document.getElementById(id);
}

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
      if (currentPage !== "mobile" && IS_DESKTOP) {
        const signaturesHtml = areSignaturesPresentResult
          ? '<a href="javascript:redirectToFullList();">Signatures</a>'
          : '<span class="missing-signatures">Missing signatures!</span>';

        html += ` · ${signaturesHtml}`;
      }

      versionEl.innerHTML = html;
    });
  });
}

function redirectToUniversalPage() {
  location.href = './';
}

function redirectToAndroid() {
  location.href = './android';
}

function redirectToMac() {
  location.href = './mac';
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
  } else if (platform === 'Android') {
    redirectToAndroid();
  } else if (platform === 'macOS') {
    redirectToMac();
  } else if (platform === 'iOS' || platform === 'Android') {
    redirectToStore(platform);
  }
}

function downloadAndroidDirect() {
  packagesPromise.then((packages) => {
    location.href = MOBILE_URLS.androidDirect.replace('%VERSION%', packages.$version);
  });
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

function setupRateButtons() {
  $('vote-certik').classList.remove('hidden');

  const rand = Math.random();
  if (rand < 0.5) {
    Array.from(document.body.querySelectorAll('.store')).forEach((btnEl) => {
      btnEl.classList.remove('hidden');
    });

    if (platform === 'iOS') {
      $('rate-google-play').classList.add('secondary-btn');
      $('rate-chrome-web-store').classList.add('secondary-btn');
    } else if (platform === 'Android') {
      $('rate-app-store').classList.add('secondary-btn');
      $('rate-chrome-web-store').classList.add('secondary-btn');
    } else {
      $('rate-app-store').classList.add('secondary-btn');
      $('rate-google-play').classList.add('secondary-btn');
    }
  } else {
    // Hide store buttons
    Array.from(document.body.querySelectorAll('.non-store')).forEach((btnEl) => {
      btnEl.classList.remove('hidden');
    });
  }
}
