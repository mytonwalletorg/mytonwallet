module.exports = {
  setupFilesAfterEnv: ['./tests/init.js'],
  moduleNameMapper: {
    '\\.(css|scss|jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|tgs)$':
      '<rootDir>/tests/staticFileMock.js',
  },
  testPathIgnorePatterns: [
    '<rootDir>/tests/playwright/',
    '<rootDir>/node_modules/',
    '<rootDir>/client/src/stylesheets/',
  ],
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '\\.(jsx?|tsx?)$': 'babel-jest',
    '\\.txt$': 'jest-raw-loader',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(axios)/)',
  ],
};
