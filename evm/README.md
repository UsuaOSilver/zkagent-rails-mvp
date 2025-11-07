# EVM Contracts (Foundry)

Core Solidity contracts for the zkAgent Rails MVP on EVM chains.

## Contracts

- **CompliancePaymaster** — ERC-4337 paymaster that accepts verifiable agent attestations and enforces policy guards
- **DollarRouter** — Normalizes various stablecoins to canonical USDC for merchant payouts
- **MerchantReceipts** — Emits audit-ready on-chain receipts for compliance tracking
- **KYCRegistry** — Optional ZK/SSI membership verification via Merkle roots
- **MockEAS** — Minimal EAS (Ethereum Attestation Service) mock for local testing

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export RPC_URL=https://...

# Deploy contracts
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## Architecture

All contracts follow CEI (Checks-Effects-Interactions) pattern and include reentrancy guards where state mutates. See `THREATMODEL.md` at repo root for security considerations.
