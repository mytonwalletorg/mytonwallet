import { TON_DNS_ZONES } from '../../../../config';
import { checkIsTrustedCollection, getHasTrustedCollections } from '../../../common/addresses';
import { getIsNftUnverified } from './metadata';

jest.mock('../../../common/addresses', () => ({
  checkHasScamLink: jest.fn(() => false),
  checkIsTrustedCollection: jest.fn(() => false),
  getHasTrustedCollections: jest.fn(() => true),
}));

const TRUSTED_COLLECTION = 'EQBDMXqg2YcGmMnn5_bXG63y-hh_YNV0dx-ylx-vL3v_WZt4';
const UNKNOWN_COLLECTION = 'EQAglL_g6q2AhMK_BT9jN1F-8jBlv2pOI30vRkPluU9kcXgV';

describe('getIsNftUnverified', () => {
  beforeEach(() => {
    jest.mocked(getHasTrustedCollections).mockReturnValue(true);
    jest.mocked(checkIsTrustedCollection).mockImplementation((address) => address === TRUSTED_COLLECTION);
  });

  it('marks an NFT of an unknown collection', () => {
    expect(getIsNftUnverified({ collectionAddress: UNKNOWN_COLLECTION })).toBe(true);
  });

  it('marks an NFT without a collection', () => {
    expect(getIsNftUnverified({})).toBe(true);
  });

  it('keeps every NFT unmarked until the backend list arrives', () => {
    jest.mocked(getHasTrustedCollections).mockReturnValue(false);
    expect(getIsNftUnverified({ collectionAddress: UNKNOWN_COLLECTION })).toBeUndefined();
  });

  it('skips a collection trusted by the backend', () => {
    expect(getIsNftUnverified({ collectionAddress: TRUSTED_COLLECTION })).toBeUndefined();
  });

  it.each(TON_DNS_ZONES.map(({ collectionName, resolver }) => [collectionName, resolver]))(
    'skips %s domains',
    (_, resolver) => {
      expect(getIsNftUnverified({ collectionAddress: resolver })).toBeUndefined();
    },
  );
});
