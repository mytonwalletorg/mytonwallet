// Mock for @mytonwallet/native-bottom-sheet
const mockBottomSheet = {
  prepare: jest.fn().mockResolvedValue(undefined),
  applyScrollPatch: jest.fn().mockResolvedValue(undefined),
  clearScrollPatch: jest.fn().mockResolvedValue(undefined),
  disable: jest.fn().mockResolvedValue(undefined),
  enable: jest.fn().mockResolvedValue(undefined),
  hide: jest.fn().mockResolvedValue(undefined),
  show: jest.fn().mockResolvedValue(undefined),
  delegate: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  openSelf: jest.fn().mockResolvedValue(undefined),
  closeSelf: jest.fn().mockResolvedValue(undefined),
  toggleSelfFullSize: jest.fn().mockResolvedValue(undefined),
  openInMain: jest.fn().mockResolvedValue(undefined),
  isShown: jest.fn().mockResolvedValue({ value: false }),
  addListener: jest.fn().mockImplementation(() => ({
    remove: jest.fn(),
  })),
};

module.exports = {
  BottomSheet: mockBottomSheet,
};
