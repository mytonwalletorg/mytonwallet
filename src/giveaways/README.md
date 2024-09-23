# MyTonWallet Giveaways

User Interface for the MTW Giveaways App

## Environment Setup

To run the app, you need to define the following variables in the `.env` file:

```
GIVEAWAYS_API_URL=http://0.0.0.0:5005
GIVEAWAY_CAPTCHA_PUBLIC_KEY=0x4AAAAAAAfLVdCxrrNsQQCp # Turnstile captcha public key
```

## Development Mode

To start the app in development mode, run:

```sh
npm run giveaways:dev
```

## Build

To build the app, run:

```sh
npm run giveaways:build
```

### Build in Development Mode

To build the app in development mode, run:

```sh
npm run giveaways:build:dev
```
