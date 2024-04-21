import dns from './dns';

const TON_ADDRESS_REGEX = /^[-\w_]{48}$/i;
const TON_RAW_ADDRESS_REGEX = /^0:[\da-h]{64}$/i;

export function isTonAddressOrDomain(address?: string) {
  return (
    address && (TON_ADDRESS_REGEX.test(address) || TON_RAW_ADDRESS_REGEX.test(address) || dns.isDnsDomain(address))
  );
}
