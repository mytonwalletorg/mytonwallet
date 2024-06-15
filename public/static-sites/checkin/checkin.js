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

window.onloadTurnstileCallback = captchaLoadedResolve;

const connector = new TonConnectSDK.TonConnect({ manifestUrl: MANIFEST_URL });
connector.disconnect();
// connector.restoreConnection();
connector.onStatusChange(handleConnectorStatusChange);

const checkinBtn = $('checkin-btn');

setupButtons();
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

    connector.connect({ jsBridgeKey: JSBRIDGE_KEY });
    return;
  }

  bridge = 'sse';

  const universalLink = connector.connect({
    universalLink: UNIVERSAL_LINK,
    bridgeUrl: BRIDGE_URL,
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

  address = TonConnectSDK.toUserFriendlyAddress(walletInfo?.account?.address);

  await captchaLoadedPromise;

  createCaptchaWidget();
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

      showSlide('processing');

      setTimeout(() => {
        submitCheckin(token);
      }, 500);
    },
  });

  showSlide('cf-turnstile');
}

function showSlide(id) {
  Array.from($('slide-container').children)
    .forEach((child) => {
      child.classList.toggle('faded', child.id !== id);
    });
}

async function submitCheckin(captchaToken) {
  const queryParams = new URLSearchParams(window.location.search);

  if (queryParams.get('r') === 'connect-bot') {
    processConnectBot();
    return;
  }

  const response = await fetch('https://api.mytonwallet.org/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      captchaToken,
      address,
      bridge,
      platform: getPlatform(),
      lang: navigator.language,
      ...Object.fromEntries(queryParams.entries()),
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

  handleSuccess(data.refAddress, data.referrals);
}

function processConnectBot() {
  const botUrl = `https://t.me/${BOT_USERNAME}/?start=auth-${address}`;

  if (window.open(botUrl)) {
    window.close();
  }

  $('connect-bot-btn').addEventListener('click', () => {
    window.open(botUrl);
    window.close();
  });

  showSlide('connect-bot');
}

function handleSuccess(refAddress, referrals) {
  showSlide('ref-container');

  const refContainerEl = $('ref-container');
  const linkEl = refContainerEl.querySelector('a');
  linkEl.addEventListener('click', handleCopy);
  linkEl.innerHTML = [
    REF_LINK_PREFIX.replace('https://', ''),
    address.slice(0, 24),
    address.slice(24),
  ].join('<br />');

  $('show-referral-stats').classList.remove('faded');
  $('invited-me').textContent = shortenAddress(refAddress);
  $('invited-by-me').innerHTML = '<br />' + referrals
    .map(({ friendlyAddress }) => shortenAddress(friendlyAddress))
    .join('<br />');
}

function showError(msg) {
  const errorEl = $('error');
  errorEl.textContent = msg;

  showSlide('error');
}

function setupButtons() {
  if (navigator.clipboard) {
    const copyBtnEl = $('copy-btn');
    copyBtnEl.addEventListener('click', handleCopy);
    copyBtnEl.classList.remove('hidden');
  }

  if (navigator.canShare) {
    const shareBtnEl = $('share-btn');
    shareBtnEl.addEventListener('click', handleShare);
    shareBtnEl.classList.remove('hidden');
  }

  // Hack to allow `useWebViewBridge` intercept the link
  document.querySelector('#join-giveaway a').addEventListener('click', (e) => {
    e.preventDefault();

    window.open(e.currentTarget.href);
  });

  $('show-referral-stats').addEventListener('click', showReferralStats);
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

function showReferralStats() {
  $('show-referral-stats').classList.add('hidden');

  const referralStatsEl = $('referral-stats');
  referralStatsEl.classList.remove('hidden');
  requestAnimationFrame(() => {
    referralStatsEl.classList.remove('faded');
  });
}

function shortenAddress(address, shift = 6, fromRight = shift) {
  if (!address) return undefined;

  return `${address.slice(0, shift)}…${address.slice(-fromRight)}`;
}
