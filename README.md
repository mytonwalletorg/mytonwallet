# ION Wallet

ION Wallet is a self-custodial wallet being migrated from the MyTonWallet codebase for the ION ecosystem. The target product supports ION/TON and ION on BNB Chain across web, browser extension, Electron, Android, and iOS through Capacitor.

This repository is in active migration. Public endpoints, wallet registries, mobile-store listings, policies, help pages, and brand assets are not yet release-ready. Their current status and required work live in [Migration to ION](MIGRATION_TO_ION.md) and the [rebranding resource registry](REBRANDING_RESOURCE_REGISTRY.md).

## Product scope

- ION/TON wallet functionality
- ION as the supported ION asset on BNB Chain
- Self-custodial key management
- Web, browser extension, Electron, and Capacitor mobile applications

Removed product areas include the native Air client, Telegram Mini App integration, Telegram Gifts, gasless/Diesel, MFA, Agent, Ledger hardware wallets, My Wallet Cards and Giveaway, and legacy networks outside the current scope.

## Development

### Requirements

Development is supported on macOS and Linux. Windows builds additionally need a Bash-compatible shell and a ZIP utility.

### Local setup

```sh
cp .env.example .env
npm ci
```

### Run locally

```sh
npm run dev
```

Useful checks:

```sh
npm run check
npm test -- --runInBand
npm run build
```

See [Electron notes](docs/electron.md) and [GPG verification](docs/gpg-check.md) for platform-specific development details.

## Release work

Do not publish an artifact solely from the repository configuration. Before a public release, complete the endpoint, registry, store, policy, signing, and visual-asset work in [REBRANDING_RESOURCE_REGISTRY.md](REBRANDING_RESOURCE_REGISTRY.md).

## Contributing

Please open a pull request with a focused change and the checks you ran. Follow the repository style and commit conventions.
