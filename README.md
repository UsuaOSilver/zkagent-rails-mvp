# zkAgent Rails — MVP (EVM + Starknet + Agent)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg)](https://getfoundry.sh/)
[![Starknet](https://img.shields.io/badge/Starknet-Ready-purple.svg)](https://www.starknet.io/)

Verifiable AI-to-onchain payments. An ERC-4337-style **Compliance Paymaster** accepts a **verifiable agent attestation** + optional ZK/SSI membership and enforces **policy guards** (allow-listed tokens, spend caps, per-epoch rate limits). A **Dollar Router** normalizes stables to a canonical merchant stable (USDC), and **Merchant Receipts** emit audit-ready logs for compliance. A minimal **Starknet Policy Guard** is included to qualify for Starknet residency.

## Why zkAgent Rails?

- **Gasless Agent Payments** — ERC-4337 paymaster sponsors gas for verified agent operations
- **Compliance First** — Policy guards enforce spend caps, token allowlists, and epoch limits
- **Stablecoin Routing** — Automatic conversion of any supported stable to USDC
- **Audit Trail** — On-chain receipts for regulatory compliance
- **Multi-Chain** — EVM contracts + Starknet policy guards

## Project Structure

```
zkagent-rails-mvp/
├── evm/              # Solidity contracts (Foundry)
│   ├── CompliancePaymaster.sol
│   ├── DollarRouter.sol
│   ├── MerchantReceipts.sol
│   └── KYCRegistry.sol
├── agent/            # TypeScript attestation runner
├── client/           # UserOp sender script
├── server/           # Express.js API backend
├── app/              # Next.js demo UI
├── starknet/         # Cairo 1 Policy Guard contracts
├── THREATMODEL.md    # Security analysis & mitigations
└── PITCH.md          # Application brief for programs
```

## Documentation

- [`evm/README.md`](./evm/README.md) — EVM contracts, build & deploy instructions
- [`agent/README.md`](./agent/README.md) — Agent attestation runner
- [`client/README.md`](./client/README.md) — UserOp sender setup
- [`server/README.md`](./server/README.md) — Backend API
- [`starknet/README.md`](./starknet/README.md) — Starknet contracts
- [`THREATMODEL.md`](./THREATMODEL.md) — Security threat model

## Prerequisites

- [Foundry](https://getfoundry.sh/) (for EVM contracts)
- [Node.js](https://nodejs.org/) v18+ (for agent/client/server)
- [Scarb](https://docs.swmansion.com/scarb/) (for Starknet contracts)
- [Starkli](https://book.starknet.io/ch02-01-starkli.html) or sncast (for Starknet deployment)

## Quickstart

### 1. Clone & Setup

```bash
git clone https://github.com/yourusername/zkagent-rails-mvp.git
cd zkagent-rails-mvp
```

### 2. EVM Contracts

```bash
cd evm
forge build
forge test

# Deploy (set your environment variables first)
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

### 3. Agent Attestation Runner

```bash
cd agent
npm install
npm run build
node dist/runner.js --model gpt-4o-mini --prompt "Pay merchant A 5 USDC" --plan "Buy coffee" --callDataHash 0xabc... --epoch 202511
```

### 4. Client (Send UserOp)

```bash
cd client
npm install
cp .env.example .env
# Edit .env with your values (PIMLICO_API_KEY, PAYMASTER, TARGET)
node sendUserOp.mjs
```

### 5. Starknet Contracts

```bash
cd starknet
scarb build

# Deploy on Sepolia testnet
starkli declare target/dev/policy_guard.sierra.json
starkli deploy <class_hash> <attester_address_felt>
```

## Features

### ERC-4337 Compliance Paymaster
- Verifies agent attestations before sponsoring gas
- Enforces per-epoch spend caps and rate limits
- Supports token allowlists and merchant whitelists
- Compatible with EAS (Ethereum Attestation Service)

### Dollar Router
- Swaps any supported stablecoin to USDC
- Slippage protection with `amountOutMin`
- DEX-agnostic design (Uniswap, Curve, etc.)

### Merchant Receipts
- On-chain audit logs for every payment
- Hashed nullifiers for privacy
- Compliance-ready event emissions

### Starknet Policy Guard
- Minimal Cairo 1 implementation
- Attester-signed policy commitments
- Cross-chain policy verification

## Architecture

```
┌─────────────┐
│   Agent     │ (generates attestation)
└──────┬──────┘
       │
       v
┌─────────────┐
│   Client    │ (constructs UserOp)
└──────┬──────┘
       │
       v
┌─────────────┐
│  Bundler    │ (Pimlico, Stackup, etc.)
└──────┬──────┘
       │
       v
┌─────────────┐
│  Paymaster  │ (verifies attestation, sponsors gas)
└──────┬──────┘
       │
       v
┌─────────────┐
│  Merchant   │ (receives USDC, emits receipt)
└─────────────┘
```

## Security

See [`THREATMODEL.md`](./THREATMODEL.md) for:
- Trust assumptions
- Invariants
- Abuse cases & mitigations
- Audit recommendations
## License

MIT License - see [`LICENSE`](./LICENSE) for details.

---
