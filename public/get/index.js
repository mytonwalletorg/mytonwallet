const REPO = 'mytonwalletorg/mytonwallet';
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const LATEST_RELEASE_WEB_URL = `https://github.com/${REPO}/releases/latest`;

const userAgent = window.navigator.userAgent.toLowerCase();

// Request the latest release information from GitHub
const releases = fetch(LATEST_RELEASE_API_URL)
  .then(response => response.json())
  .then(data => {
    return data.assets.reduce((acc, {
      name,
      browser_download_url,
    }) => {
      if (name.endsWith('.exe')) {
        acc['win'] = browser_download_url;
      } else if (name.endsWith('.AppImage')) {
        acc['linux'] = browser_download_url;
      } else if (name.endsWith('.dmg')) {
        acc[`mac-${name.includes('arm') ? 'arm' : 'x64'}`] = browser_download_url;
      }

      return acc;
    }, {});
  })
  .catch((error) => {
    console.error('Error:', error);
  });

function download(platform) {
  releases.then((byPlatform) => {
    location.href = byPlatform[platform];
  });
}

function redirectToMac() {
  if (!location.href.includes('mac.html')) {
    location.href = './mac.html';
  }
}

function redirectToFullList() {
  location.href = LATEST_RELEASE_WEB_URL;
}

function downloadDefault() {
  if (userAgent.includes('win')) {
    download('win');
  } else if (userAgent.includes('linux')) {
    download('linux');
  } else if (userAgent.includes('mac')) {
    redirectToMac();
  } else {
    alert('Your operating system is not supported.');
  }
}

if (userAgent.includes('mac')) {
  redirectToMac();
}
