const path = require('path');
const dotenv = require('dotenv');

const {
  DefinePlugin,
  EnvironmentPlugin,
  ProvidePlugin,
  NormalModuleReplacementPlugin,
} = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { GitRevisionPlugin } = require('git-revision-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const {
  HEAD,
  ENV_EXTENSION,
} = process.env;

const gitRevisionPlugin = new GitRevisionPlugin();
const branch = HEAD || gitRevisionPlugin.branch();
const appRevision = (!branch || branch === 'HEAD') ? gitRevisionPlugin.commithash().substring(0, 7) : branch;
const appVersion = require('./package.json').version;

dotenv.config();

module.exports = (_env, { mode = 'production' }) => {
  return {
    mode,
    target: 'web',

    entry: {
      main: './src/index.tsx',
      extensionServiceWorker: './src/extension/serviceWorker.ts',
      extensionContentScript: './src/extension/contentScript.ts',
      extensionProvider: './src/extension/provider.ts',
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
          directory: path.resolve(__dirname, 'node_modules/emoji-data-ios'),
        },
        {
          directory: path.resolve(__dirname, 'node_modules/opus-recorder/dist'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/webp'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/rlottie'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/secret-sauce'),
        },
      ],
      devMiddleware: {
        stats: 'minimal',
      },
    },

    output: {
      filename: (pathData) => (pathData.chunk.name.startsWith('extension') ? '[name].js' : '[name].[contenthash].js'),
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
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'postcss-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg|png|jpg|tgs)(\?v=\d+\.\d+\.\d+)?$/,
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
    },

    plugins: [
      new HtmlPlugin({
        template: 'src/index.html',
        chunks: ['main'],
      }),
      new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[name].[chunkhash].css',
        ignoreOrder: true,
      }),
      new EnvironmentPlugin({
        APP_ENV: 'production',
        APP_MOCKED_CLIENT: '',
        APP_NAME: null,
        APP_VERSION: appVersion,
        APP_REVISION: appRevision,
        TEST_SESSION: null,
        TONWEB_API_KEY: undefined,
        TONWEB_TESTNET_API_KEY: null,
        TONWEB_MAINNET_API_URL: null,
        TONWEB_TESTNET_API_URL: null,
        BRILLIANT_API_BASE_URL: null,
        TONAPIIO_SERVER_KEY: null,
        TONAPIIO_BASE_URL: null,
        PROXY: null,
      }),
      new DefinePlugin({
        APP_REVISION: DefinePlugin.runtimeValue(() => {
          const {
            branch,
            commit,
          } = getGitMetadata();
          return JSON.stringify((!branch || branch === 'HEAD') ? commit : branch);
        }, mode === 'development' ? true : []),
      }),
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new CopyWebpackPlugin({
        patterns: [{
          from: 'src/extension/manifest.json',
          transform: (content) => content.toString().replace('%%VERSION%%', appVersion),
        }],
      }),
      ...(mode === 'production' ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        }),
      ] : []),
      ...(ENV_EXTENSION === '1' ? [new NormalModuleReplacementPlugin(
        /src\/api\/providers\/worker\/index\.ts/,
        '../extension/index.ts',
      )] : []),
    ],

    devtool: ENV_EXTENSION === '1' ? 'cheap-source-map' : 'source-map',

    ...(ENV_EXTENSION === '1' && {
      optimization: {
        minimize: false,
      },
    }),
  };
};

function getGitMetadata() {
  const gitRevisionPlugin = new GitRevisionPlugin();
  const branch = HEAD || gitRevisionPlugin.branch();
  const commit = gitRevisionPlugin.commithash().substring(0, 7);

  return {
    branch,
    commit,
  };
}
