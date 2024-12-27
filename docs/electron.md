# Electron

Electron allows to build native application, that can be installed and run on Windows, macOS and Linux.

## Table of contents

- [NPM scripts](#npm-scripts)
- [Code signing on MacOS](#code-signing-on-macos)
- [Notarize on MacOS](#notarize-on-macos)
- [GitHub release](#github-release)
- [Application updates](#application-updates)

## NPM scripts

- `npm run electron:dev`

Run Electron in development mode, concurrently starts 3 processes with watch for changes: main (main Electron process), renderer (FE code) and Webpack for Electron (compiles main Electron process from TypeScript).

- `npm run electron:webpack`

The main process code for Electron, which includes preload functionality, is written in TypeScript and is compiled using the `webpack-electron.config.js` configuration to generate JavaScript code.

- `npm run electron:build`

Prepare renderer (FE code) build, compile Electron main process code, install and build native dependencies, is used before packaging or publishing.

- `npm run electron:package:staging`

Create packages for macOS, Windows and Linux in `dist-electron` folders with `APP_ENV` as `staging` (allows to open DevTools, includes sourcemaps and does not minify built JavaScript code), can be used for manual distribution and testing packaged application.

- `npm run electron:release:production`

Create packages for macOS, Windows and Linux in `dist-electron` folders with `APP_ENV` as `production` (disabled DevTools, minified built JavaScript code), publish release to GitHub, which allows supporting automatic updates. See [GitHub release workflow](#github-release) for more info.

## Code signing on MacOS

To sign the code of your application, follow these steps:

- Install certificates to `login` folder of your Keychain.
- Download and install `Developer ID - G2` certificate from the [Apple PKI](https://www.apple.com/certificateauthority/) page.
- Under the Keychain application, go to the private key associated with your developer certificate. Then do `key > Get Info > Access Control`. Down there, make sure your application (Xcode) is in the list `Always allow access by these applications` and make sure `Confirm before allowing access` is turned on.
- A valid and appropriate identity from your keychain will be automatically used when you publish your application.

More info in the [official documentation](https://www.electronjs.org/docs/latest/tutorial/code-signing).

## Notarize on MacOS

Application notarization is done automatically in [electron-builder](https://github.com/electron-userland/electron-builder/) module, which requires `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` environment variables to be passed.

How to obtain app-specific password:

- Sign in to [appleid.apple.com](appleid.apple.com).
- In the "Sign-In and Security" section, select "App-Specific Passwords".
- Select "Generate an app-specific password" or select the Add button, then follow the steps on your screen.

## GitHub release

### GitHub access token

In order to publish new release, you need to add GitHub access token to `.env`. Generate a GitHub access token by going to https://github.com/settings/tokens/new. The access token should have the repo scope/permission. Once you have the token, assign it to an environment variable:

```
# .env
GH_TOKEN="{YOUR_TOKEN_HERE}"
```

### Publish settings

Publish configuration in `electron-builder.yml` config file allows to set GitHub repository owner/name.

### Release workflow

- Draft a new release on GitHub. Create new tag version with the value of `version` in your application `package.json`, and prefix it with `v`. “Release title” can be anything you want.

  For example, if your application `package.json` version is `1.0`, your draft’s tag version would be `v1.0`.

- Save draft release
- Run `npm run electron:publish`, which will upload build artefacts to newly created release.
- Once you are done, publish the release. GitHub will tag the latest commit.

## Application updates

The application exposes the "Auto-Updates" feature, allowing users to customize their chosen approach for controlling application updates with 2 distinct ways:

1. Auto-Updates are **turned on** (default behaviour):

This grants users the option to allow the application itself to take control of the update process and introduces two mechanisms for checking and facilitating the installation of new versions automatically:

- Update of Web version — "Update" button is displayed, leading to simple reload with `location.reload()`
- Update of Electron version — "Update" button is displayed, leading to full application reload, including download and installation of new version

In this case application is loaded from `BASE_URL` specified in GitHub repository variables (`PRODUCTION_URL` from config is taken by default).

- Auto-Updates are **turned off**:

Involves the same mechanism to check for updates, but instead of reload/install, "Update" button leads to `https://mytonwallet.app/get`

In this case application is loaded from `index.html` file from Electron application build.

### Checking for updates in Web version

In the Web version, the process of checking for a new version involves accessing the `version.txt` file through the `{ENVIRONMENT_URL}/version.txt` URL. Version in this file is automatically incremented using the `postversion` NPM script during release process.

The update check is performed by comparing the version available from `{ENVIRONMENT_URL}/version.txt` with the value from `APP_VERSION` variable, which is retrieved from the `package.json` file during the Webpack build process.

### Checking for updates in Electron

The process of checking for updates in the Electron application relies on the [electron builder Auto Updates](https://www.electron.build/auto-update) mechanism.

To determine whether an Electron update is available, the `{ENVIRONMENT_URL}/electronVersion.txt` file is utilized.

**Important**: this file should be manually updated to match the version specified in the `package.json` before initiating a release. The version in `electronVersion.txt` should only be incremented if the release includes changes related to Electron. This includes updates to Electron dependencies, modifications in Electron assets, or changes in the `src/electron` or `webpack-electron.config.ts` files and folders.

### Test scenarios

Testing of the "Auto-Updates" feature can be split into severals groups of scenarios

#### "Auto-Updates" feature is turned on (default scenario when user installs new application version manually)

1. **No application updates are available:**

**Prerequisites:**

- version in `package.json` and in `${ENVIRONMENT_URL}/version.txt` files is the same
- version in `package.json` and in `${ENVIRONMENT_URL}/electronVersion.txt.txt` files is the same
- no available releases in [public repo](https://github.com/mytonwalletorg/mytonwallet/releases) with version above the one in the `package.json` file

**Expected behaviour:** "Update" button is not displayed

2. **Web application update available:**

**Prerequisites:**

- version in `package.json` is lower than the one in `${ENVIRONMENT_URL}/version.txt` file
- version in `package.json` and in `${ENVIRONMENT_URL}/electronVersion.txt.txt` files is the same
- no available releases in [public repo](https://github.com/mytonwalletorg/mytonwallet/releases) with version above the one in the `package.json` file

**Expected behaviour:** "Update" button is visible, on click application content reloads, "Update" button disappears

3. **Electron application update available:**

**Prerequisites:**

- version in `package.json` and in `${ENVIRONMENT_URL}/version.txt` files is the same
- version in `package.json` is lower that the one is in `${ENVIRONMENT_URL}/electronVersion.txt.txt` files
- since version bump in `electronVersion.txt` file should be done right before release, there is a new available release in [public repo](https://github.com/mytonwalletorg/mytonwallet/releases) with version above the one in the `package.json` file

**Expected behaviour:** "Update" button is visible in a few minutes after application start (update is being downloaded on the background), on click full application reload and update installation is happening

4. **Both updates are available:**

**Prerequisites:**

- version in `package.json` is lower than the one in `${ENVIRONMENT_URL}/version.txt` file
- version in `package.json` is lower that the one is in `${ENVIRONMENT_URL}/electronVersion.txt.txt` files
- since version bump in `electronVersion.txt` file should be done right before release, there is a new available release in [public repo](https://github.com/mytonwalletorg/mytonwallet/releases) with version above the one in the `package.json` file

**Expected behaviour:** "Update" button is visible, on click full application reload and update installation is happening (electron update is in higher priority over Web update)

#### "Auto-Updates" feature is turned off

The same test scenarios as when "Auto-Updates" is turned on, but instead of reload/install, "Update" button leads to `https://mytonwallet.app/get`. Button will disapper only after new update is manually installed.

#### Toggling "Auto-Updates" feature

Toggle is located in Settings > Security with "Auto-Updates" name.

**Expected behaviour:** application content is being reloaded, application state clears, all settings and session are kept. In case "Update" button is displayed, it's logic changes depending on "Auto-Updates" setting value.


#### User has version of application older that the one where Auto-Updates were introduced

**Prerequisites:**

- Clear application data from the following folders:
```
# MacOS:
~/Library/Application Support/<Your App Name>

# Windows:
C:\Users\<Your Username>\AppData\Roaming\<Your App Name>
```

- Install application with the version prior to the one, which includes "Auto-Updates" feature implemented and login

- Download and install (manually or with "Update" button) new version with "Auto-Updates" feature

**Expected behaviour:** session and all settings are kept, "Auto-Updates" is turned on in the Settings, "Update" button is not visible
