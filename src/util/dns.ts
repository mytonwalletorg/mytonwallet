const zones = ['ton', 't.me', 'vip'];
const zonesRegex = {
  ton: /^([-\da-z]{4,126})\.ton$/i,
  't.me': /^([-_\da-z]{4,126})\.t\.me$/i,
  vip: /^([\da-z]{1,24})\.(vip|vip\.ton|ton\.vip)$/i,
};

function isDnsDomain(value: string) {
  return Object.values(zonesRegex).some((zone) => zone.test(value));
}

function isVipDnsDomain(value: string) {
  return zonesRegex.vip.test(value);
}

function removeZone(value: string) {
  return Object.values(zonesRegex).map((zone) => (
    zone.test(value) && value.match(zone)![1]
  )).find(Boolean);
}

export default {
  zones,
  zonesRegex,
  isDnsDomain,
  isVipDnsDomain,
  removeZone,
};
