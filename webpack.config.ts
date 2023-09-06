import StatoscopeWebpackPlugin from '@statoscope/webpack-plugin';
// @ts-ignore
import PreloadWebpackPlugin from '@vue/preload-webpack-plugin';
// @ts-ignore
import WebpackBeforeBuildPlugin from 'before-build-webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import dotenv from 'dotenv';
import fs from 'fs';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import HtmlPlugin from 'html-webpack-plugin';
import yaml from 'js-yaml';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import type { Compiler, Configuration } from 'webpack';
import {
  DefinePlugin, EnvironmentPlugin, NormalModuleReplacementPlugin,
  ProvidePlugin,
} from 'webpack';

import 'webpack-dev-server';

const { APP_ENV, HEAD } = process.env;
const IS_EXTENSION = process.env.IS_EXTENSION === '1';
const IS_ELECTRON = process.env.IS_ELECTRON === '1';
const IS_FIREFOX_EXTENSION = process.env.IS_FIREFOX_EXTENSION === '1';
const IS_OPERA_EXTENSION = process.env.IS_OPERA_EXTENSION === '1';

const gitRevisionPlugin = new GitRevisionPlugin();
const branch = HEAD || gitRevisionPlugin.branch();
const appRevision = !branch || branch === 'HEAD' ? gitRevisionPlugin.commithash()?.substring(0, 7) : branch;
const STATOSCOPE_REFERENCE_URL = 'https://beta.mytonwallet.app/statoscope-build-statistics.json';
const canUseStatoscope = !IS_EXTENSION && !IS_ELECTRON;
const canUseBuildReference = canUseStatoscope && APP_ENV === 'staging';

// The `connect-src` rule contains `https:` due to arbitrary requests are needed for jetton JSON configs.
// The `img-src` rule contains `https:` due to arbitrary image URLs being used as jetton logos.
// The `media-src` rule contains `data:` because of iOS sound initialization.
const CSP = `
  default-src 'none';
  manifest-src 'self';
  connect-src 'self' https: http://localhost:3000;
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' https://fonts.googleapis.com/;
  img-src 'self' data: https:;
  media-src 'self' data:;
  object-src 'none';
  base-uri 'none';
  font-src 'self' https://fonts.gstatic.com/;
  form-action 'none';`
  .replace(/\s+/g, ' ').trim();

const appVersion = require('./package.json').version;

const defaultI18nFilename = path.resolve(__dirname, './src/i18n/en.json');

dotenv.config();

export default function createConfig(
  _: any,
  { mode = 'production' }: { mode: 'none' | 'development' | 'production' },
): Configuration {
  return {
    mode,
    target: 'web',

    optimization: {
      usedExports: true,
      ...(APP_ENV === 'staging' && {
        chunkIds: 'named',
      }),
      ...(IS_EXTENSION && {
        minimize: false,
      }),
    },

    entry: {
      main: './src/index.tsx',
      extensionServiceWorker: './src/extension/serviceWorker.ts',
      extensionContentScript: './src/extension/contentScript.ts',
      extensionPageScript: './src/extension/pageScript/index.ts',
    },

    devServer: {
      port: 4321,
      host: '0.0.0.0',
      allowedHosts: 'all',
      hot: false,
      static: [
        {
          directory: path.resolve(__dirname, 'public'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/rlottie'),
        },
      ],
      devMiddleware: {
        stats: 'minimal',
      },
      headers: {
        'Content-Security-Policy': CSP,
      },
    },

    watchOptions: { ignored: defaultI18nFilename },

    output: {
      filename: (pathData) => (pathData.chunk?.name?.startsWith('extension') ? '[name].js' : '[name].[contenthash].js'),
      chunkFilename: '[id].[chunkhash].js',
      assetModuleFilename: '[name].[contenthash][ext]',
      path: path.resolve(__dirname, 'dist'),
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
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
              },
            },
            'postcss-loader',
          ],
        },
        {
          test: /\.module\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                modules: {
                  exportLocalsConvention: 'camelCase',
                  auto: true,
                  localIdentName: mode === 'production' ? '[hash:base64]' : '[name]__[local]',
                },
              },
            },
            'postcss-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.scss$/,
          exclude: /\.module\.scss$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader', 'sass-loader'],
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg|png|jpg|tgs|webp)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
        },
        {
          test: /\.wasm$/,
          type: 'asset/resource',
        },
        {
          test: /\.(txt|tl)$/i,
          type: 'asset/source',
        },
      ],
    },

    resolve: {
      extensions: ['.js', '.ts', '.tsx'],
      fallback: {
        crypto: false,
      },
      alias: {
        // It is used to remove duplicate dependencies
        'bn.js': path.join(__dirname, 'node_modules/bn.js/lib/bn.js'),
      },
    },

    plugins: [
      ...(canUseBuildReference ? [{
        apply: (compiler: Compiler) => {
          compiler.hooks.compile.tap('Before Compilation', async () => {
            try {
              const stats = await fetch(STATOSCOPE_REFERENCE_URL).then((res) => res.text());
              // Quick and simple json validator
              JSON.parse(stats);
              fs.writeFileSync(path.resolve('./public/statoscope-master-reference.json'), stats);
              // eslint-disable-next-line no-console
              console.info('Reference statoscope stats fetched');
            } catch (err: any) {
              fs.writeFileSync(path.resolve('./public/statoscope-master-reference.json'), '{}');

              // eslint-disable-next-line no-console
              console.warn('Failed to fetch reference statoscope stats: ', err.message);
            }
          });
        },
      }] : []),
      ...(IS_OPERA_EXTENSION ? [{
        apply: (compiler: Compiler) => {
          compiler.hooks.afterDone.tap('After Compilation', async () => {
            const dir = './dist/';

            for (const filename of await fs.promises.readdir(dir)) {
              const file = path.join(dir, filename);

              if (file.endsWith('.tgs')) {
                await fs.promises.rename(file, file.replace('.tgs', '.json'));
              } else if (filename.includes('main') && filename.endsWith('.js')) {
                const content = (await fs.promises.readFile(file))
                  .toString('utf-8')
                  .replace(/\.tgs"/g, '.json"');
                await fs.promises.writeFile(file, content);
              }
            }
          });
        },
      }] : []),
      new WebpackBeforeBuildPlugin((stats: any, callback: VoidFunction) => {
        const defaultI18nYaml = fs.readFileSync('./src/i18n/en.yaml', 'utf8');
        const defaultI18nJson = convertI18nYamlToJson(defaultI18nYaml, mode === 'production');

        if (!defaultI18nJson) {
          return;
        }

        fs.writeFile(defaultI18nFilename, defaultI18nJson, 'utf-8', () => {
          callback();
        });
      }),
      new HtmlPlugin({
        template: 'src/index.html',
        chunks: ['main'],
        csp: CSP,
      }),
      new PreloadWebpackPlugin({
        include: 'allAssets',
        fileWhitelist: [
          /duck_.*?\.png/, // Lottie thumbs
          /theme_.*?\.png/, // All theme icons
          /settings_.*?\.svg/, // All settings svg icons
        ],
        as(entry: string) {
          if (/\.png$/.test(entry)) return 'image';
          if (/\.svg$/.test(entry)) return 'image';
          return 'script';
        },
      }),
      new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[name].[chunkhash].css',
        ignoreOrder: true,
      }),
      /* eslint-disable no-null/no-null */
      new EnvironmentPlugin({
        APP_ENV: 'production',
        APP_NAME: null,
        APP_VERSION: appVersion,
        APP_REVISION: appRevision,
        TEST_SESSION: null,
        TONHTTPAPI_MAINNET_URL: null,
        TONHTTPAPI_MAINNET_API_KEY: null,
        TONHTTPAPI_TESTNET_URL: null,
        TONHTTPAPI_TESTNET_API_KEY: null,
        TONAPIIO_MAINNET_URL: null,
        TONAPIIO_TESTNET_URL: null,
        BRILLIANT_API_BASE_URL: null,
        PROXY_HOSTS: null,
        STAKING_POOLS: null,
        IS_ELECTRON: false,
        ELECTRON_TONHTTPAPI_MAINNET_API_KEY: null,
        ELECTRON_TONHTTPAPI_TESTNET_API_KEY: null,
        IS_EXTENSION: false,
        IS_FIREFOX_EXTENSION: false,
      }),
      /* eslint-enable no-null/no-null */
      new DefinePlugin({
        APP_REVISION: DefinePlugin.runtimeValue(
          () => {
            const { gitBranch, commit } = getGitMetadata();
            return JSON.stringify(!gitBranch || gitBranch === 'HEAD' ? commit : gitBranch);
          },
          mode === 'development' ? true : [],
        ),
      }),
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/extension/manifest.json',
            transform: (content) => {
              const manifest = JSON.parse(content.toString());
              manifest.version = appVersion;
              manifest.content_security_policy = {
                extension_pages: CSP,
              };

              if (IS_FIREFOX_EXTENSION) {
                manifest.background = {
                  scripts: [manifest.background.service_worker],
                };
                manifest.host_permissions = ['<all_urls>'];
                manifest.permissions = manifest.permissions.filter((value: string) => value !== 'system.display');
                manifest.browser_specific_settings = {
                  gecko: {
                    id: '{98fcdaee-2b58-4f71-8a3c-f0c66f24dede}',
                    strict_min_version: '91.1.0', // Minimum version for using a proxy
                  },
                };
              }

              return JSON.stringify(manifest, undefined, 2);
            },
          },
          {
            from: 'src/i18n/*.yaml',
            to: 'i18n/[name].json',
            transform: (content: Buffer) => convertI18nYamlToJson(
              content as unknown as string, mode === 'production',
            ) as any,
          },
        ],
      }),
      ...(canUseStatoscope ? [new StatoscopeWebpackPlugin({
        statsOptions: {
          context: __dirname,
        },
        saveReportTo: path.resolve('./public/statoscope-report.html'),
        saveStatsTo: path.resolve('./public/statoscope-build-statistics.json'),
        normalizeStats: true,
        open: false,
        extensions: [new WebpackContextExtension()], // eslint-disable-line @typescript-eslint/no-use-before-define
        ...(canUseBuildReference ? {
          additionalStats: ['./public/statoscope-master-reference.json'],
        } : {}),
      })] : []),
      ...(IS_EXTENSION
        ? [
          new NormalModuleReplacementPlugin(
            /src\/api\/providers\/worker\/connector\.ts/,
            '../extension/connectorForPopup.ts',
          ),
        ]
        : []),
    ],

    devtool:
      IS_EXTENSION ? 'cheap-source-map' : APP_ENV === 'production' && IS_ELECTRON ? undefined : 'source-map',
  };
}

function getGitMetadata() {
  const revisionPlugin = new GitRevisionPlugin();
  const commit = revisionPlugin.commithash()?.substring(0, 7);

  return {
    gitBranch: HEAD || gitRevisionPlugin.branch(),
    commit,
  };
}

function convertI18nYamlToJson(content: string, shouldThrowException: boolean): string | undefined {
  try {
    const i18n = yaml.load(content) as AnyLiteral;

    const json: AnyLiteral = Object.entries(i18n).reduce((acc: AnyLiteral, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = { value };
      }
      if (typeof value === 'object') {
        acc[key] = { ...value };
      }

      return acc;
    }, {});

    return JSON.stringify(json, undefined, 2);
  } catch (err: any) {
    console.error(err.message); // eslint-disable-line no-console

    if (shouldThrowException) {
      throw err;
    }
  }

  return undefined;
}

class WebpackContextExtension {
  context: string;

  constructor() {
    this.context = '';
  }

  handleCompiler(compiler: Compiler) {
    this.context = compiler.context;
  }

  getExtension() {
    return {
      descriptor: { name: 'custom-webpack-extension-context', version: '1.0.0' },
      payload: { context: this.context },
    };
  }
}
