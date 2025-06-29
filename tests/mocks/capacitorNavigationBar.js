// Mock for @mauricewegner/capacitor-navigation-bar
const mockNavigationBar = {
  setColor: jest.fn().mockResolvedValue(undefined),
  getColor: jest.fn().mockResolvedValue({ color: '#000000' }),
  hide: jest.fn().mockResolvedValue(undefined),
  show: jest.fn().mockResolvedValue(undefined),
};

module.exports = {
  NavigationBar: mockNavigationBar,
};
