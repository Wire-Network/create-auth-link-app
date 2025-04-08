# Wire Account Linking Demo

This repository demonstrates how to implement Wire's account auth.msg create link flow, which allows users to connect their external wallet (e.g., MetaMask) to an existing Wire account. This demo application is built with Angular and provides a reference implementation for developers.

> **Note**: This same linking flow is also implemented on [explore.wire.foundation](https://explore.wire.foundation/settle/link), which you can use as a reference for the user experience.

## Overview

`auth.msg` create link flow system enables secure connections between external wallet identities (e.g., ETH addresses) and Wire accounts.

### Key Features

- Connect external wallets (MetaMask)
- Link external wallet identities to Wire accounts
- Secure signature-based authentication
- Settlement contract actions linking (Wire Testnet only)

## How It Works

### Authentication Flow

1. **Wallet Connection & Identity Retrieval**
   - User connects their wallet (e.g., MetaMask)
   - System requests a signature to extract the public key (ETH address)
   - No private keys are exposed or transmitted

2. **Wire Account Verification**
   - System checks if a Wire account exists for the connected wallet
   - The **account must exist on the selected chain** before linking

3. **Create Link Step (Auth Link)**
   - User signs a message authorizing the link creation
   - The signature proves ownership of both the external wallet and Wire account
   - Smart contract validates the signature and creates the link

4. **Link Authorization**
   - Once linked, the system can recognize the user on the Wire network
   - On Wire Testnet, additional settlement contract actions are linked after Step 3 is completed

### Settlement Contract Actions

When connected to the Wire Testnet, upon pressing `FInalize` this demo would link the following settlement contract actions:

- `initdeposit`
- `setpending`
- `canceldep`
- `utxoxfer`
- `withdraw`

## Setup

### Prerequisites

- Node.js (v20 or higher)
- MetaMask or compatible Web3 wallet

### Quick Start

```bash
# Install dependencies and start the app
npm ci && npm start
```

The app will be available at `http://localhost:4200`

### Required Packages

This demo uses the following public npm packages:

- `@wireio/core`: Core Wire functionality
- `@wireio/wns`: Wire Name Service integration
- `@walletconnect/ethereum-provider`: Wallet connection handling
- `ethers`: Ethereum utilities

## Component Structure

### Key Components

- `ConnectComponent`: Handles wallet connection and account selection
- `CreateLinkComponent`: Manages the link creation process
- `ChainSelectorComponent`: Allows users to select the target chain

### Services

- `AccountService`: Manages Wire account state and operations
- `LinkService`: Handles link creation and status monitoring
- `ChainService`: Manages chain selection and interaction
- `ConnectService`: Handles wallet connection and state

## Notes

The demo is configured to work with:

- Wire Testnet (for development and testing)
- Additional networks can be configured in the `ChainService`

If you are running this demo and connected to a local chain, you would need to compile and deploy `auth.msg` to your chain and manually create the Wire accounts via `clio` before testing the flow.

<!-- ## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## License

[License Information]

## Support

For questions and support:

- [Wire Documentation]
- [Issue Tracker]
- [Contact Information] -->
