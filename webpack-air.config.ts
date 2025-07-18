import dotenv from 'dotenv';
import path from 'path';
import type { Configuration } from 'webpack';
import {
  BannerPlugin,
  EnvironmentPlugin, ProvidePlugin,
} from 'webpack';

dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appVersion = require('./package.json').version;

export default function createConfig(
  _: any,
  { mode = 'production' }: { mode: 'none' | 'development' | 'production' },
): Configuration {
  return {
    mode,

    optimization: {
      usedExports: true,
      minimize: true,
    },

    entry: {
      main: './src/api/air/index.ts',
    },

    output: {
      filename: 'mytonwallet-sdk.js',
      path: path.resolve(__dirname, 'dist-air'),
      clean: true,
    },

    module: {
      rules: [
        {
          test: /\.(ts|tsx|js)$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
      ],
    },

    resolve: {
      extensions: ['.js', '.ts', '.tsx'],
      fallback: {
        stream: require.resolve('stream-browserify'),
        process: require.resolve('process/browser'),
      },
    },

    plugins: [
      new BannerPlugin({
        banner: 'window.XMLHttpRequest = undefined;',
        raw: true,
      }),
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new ProvidePlugin({
        process: 'process/browser',
      }),
      new EnvironmentPlugin({
        APP_ENV: 'production',
        APP_VERSION: appVersion,
        IS_CAPACITOR: '1',
        IS_AIR_APP: '1',
        TONHTTPAPI_MAINNET_URL: '',
        TONHTTPAPI_MAINNET_API_KEY: '',
        TONHTTPAPI_TESTNET_URL: '',
        TONHTTPAPI_TESTNET_API_KEY: '',
        TONAPIIO_MAINNET_URL: '',
        TONAPIIO_TESTNET_URL: '',
        TONHTTPAPI_V3_MAINNET_API_KEY: '',
        TONHTTPAPI_V3_TESTNET_API_KEY: '',
        BRILLIANT_API_BASE_URL: '',
        TRON_MAINNET_API_URL: '',
        TRON_TESTNET_API_URL: '',
        PROXY_HOSTS: '',
        STAKING_POOLS: '',
      }),
    ],
  };
}
