const MANIFEST_URL = 'https://checkin.mytonwallet.org/tonconnect-manifest.json';
const JSBRIDGE_KEY = 'mytonwallet';
const UNIVERSAL_LINK = 'https://connect.mytonwallet.org';
const BRIDGE_URL = 'https://tonconnectbridge.mytonwallet.org/bridge';

const CAPTCHA_KEY = '0x4AAAAAAAWP-ib_cL3bojOS';

const REF_LINK_PREFIX = 'https://my.tt/r/';
const BOT_USERNAME = 'MyTonWalletBot';

let captchaLoadedResolve = undefined;
let captchaLoadedPromise = new Promise((resolve) => {
  captchaLoadedResolve = resolve;
});

let address = undefined;
let bridge = undefined;
let tonConnectBody = undefined;
let tronAddress = undefined;
let captchaToken = undefined;

window.onloadTurnstileCallback = captchaLoadedResolve;

const connector = new TonConnectSDK.TonConnect({ manifestUrl: MANIFEST_URL });
connector.disconnect();
// connector.restoreConnection();
connector.onStatusChange(handleConnectorStatusChange);

const checkinBtn = $('checkin-btn');

setTimeout(connect, 1000);

function $(id) {
  return document.getElementById(id);
}

async function connect() {
  const walletsList = await connector.getWallets();
  const walletInfo = walletsList.find((walletInfo) => (
    walletInfo.jsBridgeKey === JSBRIDGE_KEY && (
      TonConnectSDK.isWalletInfoCurrentlyEmbedded(walletInfo)
      || TonConnectSDK.isWalletInfoCurrentlyInjected(walletInfo)
    )
  ));

  if (walletInfo) {
    bridge = TonConnectSDK.isWalletInfoCurrentlyEmbedded(walletInfo) ? 'js-embedded' : 'js-injected';

    connector.connect({ jsBridgeKey: JSBRIDGE_KEY }, { tonProof: 'nfc-summit' });
    return;
  }

  bridge = 'sse';

  const universalLink = connector.connect({
    universalLink: UNIVERSAL_LINK,
    bridgeUrl: BRIDGE_URL,
  }, {
    tonProof: 'nfc-summit',
  });

  checkinBtn.classList.remove('disabled');
  checkinBtn.textContent = 'Check In';
  checkinBtn.href = universalLink;
}

async function handleConnectorStatusChange(walletInfo) {
  if (walletInfo?.device?.appName !== 'MyTonWallet') {
    connect();
    return;
  }

  console.log({ walletInfo });

  const tonProof = walletInfo?.connectItems?.tonProof?.proof;

  tonConnectBody = {
    address: walletInfo?.account?.address,
    network: walletInfo?.account?.chain,
    public_key: walletInfo?.account?.publicKey,
    proof: {
      ...tonProof,
      state_init: walletInfo?.account?.walletStateInit,
    }
  };

  address = TonConnectSDK.toUserFriendlyAddress(walletInfo?.account?.address);

  // await captchaLoadedPromise;

  // createCaptchaWidget();

  showSlide('tron');
}

function createCaptchaWidget() {
  const captchaWidgetId = turnstile.render('#cf-turnstile', {
    sitekey: CAPTCHA_KEY,
    callback: (token) => {
      setTimeout(() => {
        turnstile.remove(captchaWidgetId);
      }, 300);

      if (!token) {
        showError('Human Test Failed');
        return;
      }

      captchaToken = token;

      showSlide('tron');
    },
  });

  showSlide('cf-turnstile');
}

$('tron-btn').addEventListener('click', (e) => {
  e.preventDefault();

  tronAddress = $('tron-address').value;

  showSlide('processing');

  setTimeout(() => {
    submitCheckin();
  }, 500);
});

function showSlide(id) {
  Array.from($('slide-container').children)
    .forEach((child) => {
      child.classList.toggle('faded', child.id !== id);
    });

  const slideHeight = $(id).clientHeight;
  const currentHeight = $('slide-container').clientHeight;
  if (currentHeight < slideHeight) {
    $('slide-container').style.height = `${slideHeight}px`;
  } else {
    setTimeout(() => {
      $('slide-container').style.height = `${slideHeight}px`;
    }, 200);
  }
}

async function submitCheckin() {
  const queryParams = new URLSearchParams(window.location.search);
  const base = 'https://api.mytonwallet.org';
  // const base = 'http://localhost:3000';
  const response = await fetch(`${base}/checkin/nfc-summit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      captchaToken,
      secret: queryParams.get('secret'),
      tron_address: tronAddress,
      ...tonConnectBody,
    }),
  }).catch((err) => {
    showError(err.toString());
  });

  if (!response) return;

  if (!response.ok) {
    const json = await response.json();
    showError(`${response.error || response.status}. Response: ${json?.error ?? JSON.stringify(json)}`);
    return;
  }

  const data = await response.json().catch(() => undefined);

  if (!data.result) {
    showError(data.error);
    return;
  }

  handleSuccess();
}

function handleSuccess() {
  showSlide('success');
}

function showError(msg) {
  const errorEl = $('error');
  errorEl.textContent = msg;

  showSlide('error');
}

function handleCopy(e) {
  e.preventDefault();

  if (!navigator.clipboard) return;

  navigator.clipboard.writeText(getRefLink());

  const copyBtnEl = $('copy-btn');
  copyBtnEl.textContent = 'Copied!';
  copyBtnEl.classList.add('disabled');

  setTimeout(() => {
    copyBtnEl.classList.remove('disabled');
    copyBtnEl.textContent = 'Copy';
  }, 3000);
}

function handleShare(e) {
  e.preventDefault();
  navigator.share({ url: getRefLink() });
}

function getRefLink() {
  return `${REF_LINK_PREFIX}${address}`;
}

function getPlatform() {
  const {
    userAgent,
    platform,
  } = window.navigator;

  if (/Android/.test(userAgent)) return 'Android';

  if (/Linux/.test(platform)) return 'Linux';

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

  return undefined;
}

function shortenAddress(address, shift = 6, fromRight = shift) {
  if (!address) return undefined;

  return `${address.slice(0, shift)}…${address.slice(-fromRight)}`;
}

showSlide('checkin');
