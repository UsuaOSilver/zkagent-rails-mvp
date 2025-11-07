# Client (UserOp Sender)

Minimal script to construct and send ERC-4337 UserOperations using Pimlico's bundler infrastructure.

## Setup

1. Copy `.env.example` to `.env` and fill in your values:
   - `PIMLICO_API_KEY` — Get from [pimlico.io](https://pimlico.io)
   - `PAYMASTER` — Your deployed CompliancePaymaster address
   - `TARGET` — Contract address to call (e.g., MerchantReceipts)

2. Install dependencies:
```bash
npm install
```

## Usage

```bash
node sendUserOp.mjs
```

This script creates a smart account, constructs a UserOp with paymaster data, and submits it to the bundler.

## Configuration

Edit `sendUserOp.mjs` to customize:
- Target contract calls
- Gas limits
- Paymaster data (attestation hash, policy fields)
