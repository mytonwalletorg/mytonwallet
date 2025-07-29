# @push

### A mini-app for decentralized crypto transfers on Telegram

The service implements a non-custodial payment system allowing for crypto transfers between Telegram users.

**Flow:**
1. The sender creates a "check" with a unique `chat_instance` parameter and funds it with TON or jetton.
   The check is stored in a smart contract storage and can be accessed by the receiver.
2. The receiver must cash out the check by providing the same `chat_instance` value,
   signed by Telegram's server to verify their identity.
3. Upon successful verification, the contract transfers the funds to the receiver.
   The check is deleted from the contract's storage.
4. In case of an error, the contract refunds the funds to the sender.
   Again, the check is deleted from the contract's storage.

### Development

To run in development mode:

```bash
npm run push:dev
```

This will start the development server on port 4324.

### Building

To build for production:

```bash
npm run push:build:production
```
