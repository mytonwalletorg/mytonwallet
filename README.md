# MyTonWallet · [mytonwallet.io](https://mytonwallet.io)

**The most feature-rich web wallet and browser extension for the [TON Network](https://ton.org)** – with support of jettons, NFT, TON DNS, TON Sites, TON Proxy, and TON Magic.

<img src="https://user-images.githubusercontent.com/102837730/193835310-1436afcd-ed78-4656-92c3-9c8f4beacacf.png" width="600" />

The wallet is **self-custodial and safe**. The developers **do not** have access to funds, browser history or any other information. We focus on **speed**, **size** and **attention to detail**. We try to avoid using third-party libraries to ensure maximum reliability and safety, and also to lower the bundle size.

## Requirements

Ready to build on **macOS** and **Linux**.

To build on **Windows**, you will also need:

- Any terminal emulator with bash (Git Bash, MinGW, Cygwin)
- A zip utility (for several commands)

## Local Setup

```sh
mv .env.example .env

npm i
```

## Dev Mode

```sh
npm run dev
```

## Electron

Electron allows to build native application, that can be installed and run on Windows, macOS and Linux.

### Installing app on Linux

In order for the application to work correctly and be displayed in the Linux menu, you need to install the AppImage via [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher)

#### NPM scripts

- `npm run dev:electron`

Run Electron in development mode, concurrently starts 3 processes with watch for changes: main (main Electron process), renderer (FE code) and Webpack for Electron (compiles main Electron process from TypeScript).

- `npm run electron:webpack`

The main process code for Electron, which includes preload functionality, is written in TypeScript and is compiled using the `webpack-electron.config.js` configuration to generate JavaScript code.

- `npm run electron:build`

Prepare renderer (FE code) build, compile Electron main process code, install and build native dependencies, is used before packaging or publishing.

- `npm run electron:staging`

Create packages for macOS, Windows and Linux in `dist-electron` folders with `APP_ENV` as `staging` (allows to open DevTools, includes sourcemaps and does not minify built JavaScript code), can be used for manual distribution and testing packaged application.

- `npm run electron:production`

Create packages for macOS, Windows and Linux in `dist-electron` folders with `APP_ENV` as `production` (disabled DevTools, minified built JavaScript code), can be used for manual distribution and testing packaged application.

- `npm run deploy:electron`

Create packages for macOS, Windows and Linux in `dist-electron` folder and publish release to GitHub, which allows supporting autoupdates. See [GitHub release workflow](#github-release) for more info.

#### Code signing on MacOS

To sign the code of your application, follow these steps:

- Install certificates to `login` folder of your Keychain.
- Download and install `Developer ID - G2` certificate from the [Apple PKI](https://www.apple.com/certificateauthority/) page.
- Under the Keychain application, go to the private key associated with your developer certificate. Then do `key > Get Info > Access Control`. Down there, make sure your application (Xcode) is in the list `Always allow access by these applications` and make sure `Confirm before allowing access` is turned on.
- A valid and appropriate identity from your keychain will be automatically used when you publish your application.

More info in the [official documentation](https://www.electronjs.org/docs/latest/tutorial/code-signing).

#### Notarize on MacOS

Application notarization is done automatically in [electron-builder](https://github.com/electron-userland/electron-builder/) module, which requires `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` environment variables to be passed.

How to obtain app-specific password:

- Sign in to [appleid.apple.com](appleid.apple.com).
- In the "Sign-In and Security" section, select "App-Specific Passwords".
- Select "Generate an app-specific password" or select the Add button, then follow the steps on your screen.

#### GitHub release

##### GitHub access token

In order to publish new release, you need to add GitHub access token to `.env`. Generate a GitHub access token by going to https://github.com/settings/tokens/new. The access token should have the repo scope/permission. Once you have the token, assign it to an environment variable:

```
# .env
GH_TOKEN="{YOUR_TOKEN_HERE}"
```

##### Publish settings

Publish configuration in `electron-builder.yml` config file allows to set GitHub repository owner/name.

##### Release workflow

- Draft a new release on GitHub. Create new tag version with the value of `version` in your application `package.json`, and prefix it with `v`. “Release title” can be anything you want.

  For example, if your application `package.json` version is `1.0`, your draft’s tag version would be `v1.0`.

- Save draft release
- Run `npm run electron:publish`, which will upload build artefacts to newly reated release.
- Once you are done, publish the release. GitHub will tag the latest commit.

## Support Us

If you like what we do, feel free to contribute by creating a pull request, or just support us using this TON wallet: `EQAIsixsrb93f9kDyplo_bK5OdgW5r0WCcIJZdGOUG1B282S`. We appreciate it a lot!
