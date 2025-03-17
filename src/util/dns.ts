const zonesRegex = {
  ton: /^([-\da-z]+\.){0,2}([-\da-z]{4,126})\.ton$/i,
  't.me': /^([-\da-z]+\.){0,2}([-_\da-z]{4,126})\.t\.me$/i,
  vip: /^(?<base>([-\da-z]+\.){0,2}([\da-z]{1,24}))\.(ton\.vip|vip\.ton|vip)$/i,
  gram: /^(?<base>([-\da-z]+\.){0,2}([\da-z]{1,24}))\.(gram)$/i,
};

function isDnsDomain(value: string) {
  return Object.values(zonesRegex).some((zone) => zone.test(value));
}

function isVipDnsDomain(value: string) {
  return zonesRegex.vip.test(value);
}

function isGramDnsDomain(value: string) {
  return zonesRegex.gram.test(value);
}

function isTMeDnsDomain(value: string) {
  return zonesRegex['t.me'].test(value);
}

function removeVipZone(value: string) {
  value = value.replace(/\.ton\.vip$/i, '.vip').replace(/\.vip\.ton$/i, '.vip');
  return value.match(zonesRegex.vip)?.groups?.base;
}

function removeGramZone(value: string) {
  return value.match(zonesRegex.gram)?.groups?.base;
}

function removeTonZone(value: string) {
  return value.replace(/\.ton$/i, '');
}

function removeTMeZone(value: string) {
  return value.replace(/\.t\.me$/i, '');
}

export default {
  isDnsDomain,
  isVipDnsDomain,
  isGramDnsDomain,
  isTMeDnsDomain,
  removeVipZone,
  removeGramZone,
  removeTonZone,
  removeTMeZone,
};
