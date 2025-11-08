# zkAgent Rails — Design Documentation

## Overview

zkAgent Rails is a compliance-first payment infrastructure for AI agents, combining ERC-4337 account abstraction with verifiable attestations and policy enforcement.

## Architecture

### High-Level Flow

```
┌──────────────┐
│  AI Agent    │ Analyzes merchant request
│  (Off-chain) │ Generates attestation
└──────┬───────┘
       │ attestation (model, prompt, plan, callDataHash, epoch)
       v
┌──────────────┐
│ Agent Runner │ Hashes attestation → policyHash
│  (Node.js)   │ Constructs paymasterAndData
└──────┬───────┘
       │ paymasterAndData
       v
┌──────────────┐
│    Client    │ Builds UserOperation
│   (EVM AA)   │ Signs with smart account
└──────┬───────┘
       │ UserOp
       v
┌──────────────┐
│   Bundler    │ Validates & bundles UserOps
│  (Pimlico)   │ Calls EntryPoint
└──────┬───────┘
       │
       v
┌──────────────┐
│  EntryPoint  │ Validates UserOp
│  (ERC-4337)  │ Calls paymaster.validatePaymasterUserOp()
└──────┬───────┘
       │
       v
┌────────────────────┐
│ CompliancePaymaster│ 1. Verify attestation exists (EAS or mock)
│    (This repo)     │ 2. Check policyHash matches expected
│                    │ 3. Verify epoch limits & caps
│                    │ 4. Check nullifier not used
│                    │ 5. Sponsor gas if valid
└──────┬─────────────┘
       │ (approved)
       v
┌──────────────┐
│ Smart Account│ Executes call to merchant contract
│  (ERC-4337)  │
└──────┬───────┘
       │
       v
┌──────────────┐
│ DollarRouter │ Swaps tokenIn → USDC
│              │ Enforces amountOutMin
└──────┬───────┘
       │ USDC
       v
┌──────────────┐
│  Merchant    │ Receives USDC payment
│   Contract   │
└──────┬───────┘
       │
       v
┌──────────────────┐
│ MerchantReceipts │ Emits on-chain Receipt event
│                  │ (payer, merchant, amounts, nullifierHash, epoch, policyHash)
└──────────────────┘
```

## Core Components

### 1. CompliancePaymaster (EVM)

**Purpose:** ERC-4337 paymaster that enforces policy guards before sponsoring gas.

**Key Features:**
- Verifies agent attestations via EAS (or mock)
- Enforces per-epoch spend caps
- Prevents replay attacks via nullifiers
- Supports token allowlists
- Compatible with EntryPoint v0.6/v0.7

**State Variables:**
```solidity
IEntryPoint public entryPoint;
IEAS public eas;
bytes32 public schemaUID;
address public attester;
mapping(bytes32 => Policy) policies;      // policyHash → Policy
mapping(bytes32 => bool) usedNullifiers;  // epoch nullifier → used
```

**Policy Structure:**
```solidity
struct Policy {
    uint256 epoch;
    uint256 capPerEpoch;
    uint256 totalSpent;
    address[] allowedTokens;
    address[] allowedMerchants;
}
```

**Validation Flow:**
1. Decode `paymasterAndData` → (attUid, policyHash, epoch)
2. Verify attestation exists: `eas.getAttestation(attUid)`
3. Check attester matches expected
4. Verify policyHash in attestation data
5. Check epoch matches policy
6. Verify spend cap not exceeded
7. Generate nullifier: `keccak256(userOpHash, epoch)`
8. Check nullifier not used
9. Mark nullifier as used
10. Return validation success

### 2. DollarRouter (EVM)

**Purpose:** Normalizes any supported stablecoin to canonical USDC for merchant payouts.

**Key Features:**
- DEX-agnostic (Uniswap, Curve, etc.)
- Slippage protection via `amountOutMin`
- Token allowlist enforcement
- Emergency pause functionality

**Functions:**
```solidity
function swapToUSDC(
    address tokenIn,
    uint256 amountIn,
    uint256 amountOutMin,
    address recipient
) external returns (uint256 amountOut);
```

**Supported Tokens (configurable):**
- USDC (passthrough)
- USDT
- DAI
- FRAX
- Others via allowlist

### 3. MerchantReceipts (EVM)

**Purpose:** Emits audit-ready on-chain receipts for compliance tracking.

**Event Structure:**
```solidity
event Receipt(
    address indexed payer,
    address indexed merchant,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    bytes32 nullifierHash,     // Privacy: hashed zkID/attestation
    uint256 indexed epoch,
    bytes32 policyHash
);
```

**Use Cases:**
- Regulatory compliance
- Merchant accounting
- Audit trails
- Analytics dashboards

### 4. KYCRegistry (EVM)

**Purpose:** Optional ZK/SSI membership verification via Merkle roots.

**Design:**
- Issuer publishes Merkle root on-chain
- User provides Merkle proof off-chain
- Contract verifies without revealing identity

**Functions:**
```solidity
function setRoot(address issuer, bytes32 root);
function verifyMembership(bytes32[] calldata proof, bytes32 leaf) returns (bool);
```

### 5. Agent Runner (Node.js)

**Purpose:** Generates verifiable attestations for agent-initiated payments.

**Process:**
1. Agent receives merchant payment request
2. Analyzes request (model: gpt-4o-mini)
3. Generates plan
4. Constructs attestation payload:
   ```typescript
   {
     model: "gpt-4o-mini",
     prompt: "Pay Merchant A 5 USDC",
     plan: "Buy coffee",
     callDataHash: keccak256(callData),
     epoch: 202511
   }
   ```
5. Hashes to `policyHash = keccak256(attestation)`
6. Submits to EAS or returns hash
7. Returns `paymasterAndData` encoding

### 6. Starknet Policy Guard (Cairo)

**Purpose:** Cross-chain policy verification on Starknet.

**Design:**
```cairo
#[storage]
struct Storage {
    attester: ContractAddress,
    policy: Map<(ContractAddress, felt252), u8>
}

#[external(v0)]
fn set_policy(user: ContractAddress, commitment: felt252, allowed: bool);

#[external(v0)]
fn check_policy(user: ContractAddress, commitment: felt252) -> bool;
```

**Integration:**
- Starknet contracts can query policy before allowing operations
- Enables cross-chain policy enforcement
- Minimal MVP for Starknet residency qualification

## Security Model

### Trust Assumptions

1. **Attester Trust:** For MVP, we trust a designated attester key (EAS signer or allowlisted address).
2. **Price Oracle Trust:** Chainlink price feeds for DEX slippage protection.
3. **Bundler Trust:** Pimlico/Stackup bundlers assumed honest (standard ERC-4337 assumption).
4. **EntryPoint Trust:** ERC-4337 EntryPoint is canonical and secure.

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| Replay attacks | Epoch nullifiers (one attestation per epoch per user) |
| Unauthorized spending | Policy guards (caps, allowlists) |
| Forged attestations | Verify attester signature via EAS |
| Policy bypass | Hash validation (policyHash must match on-chain) |
| Reentrancy | CEI pattern + ReentrancyGuard |
| Slippage attacks | amountOutMin enforcement in DollarRouter |
| Gas griefing | Gas limits in paymaster validation |
| Sybil attacks | KYC/SSI Merkle proof verification (optional) |

### Invariants

1. **No sponsorship without valid attestation** bound to userOpHash
2. **No duplicate spending** within same epoch (nullifier uniqueness)
3. **Router only swaps allowlisted tokens** to USDC
4. **Receipts emitted** for every successful payment
5. **Spend caps never exceeded** per epoch per policy

## Data Flow

### 1. Attestation Generation

```
Agent → Runner:
  { model, prompt, plan, callDataHash, epoch }

Runner → EAS:
  createAttestation(schema, data, attester)

EAS → Runner:
  attUid

Runner → Client:
  paymasterAndData = concat(paymaster, encode(attUid, policyHash, epoch))
```

### 2. UserOp Validation

```
Client → Bundler:
  UserOp { sender, nonce, callData, paymasterAndData, ... }

Bundler → EntryPoint:
  handleOps([UserOp])

EntryPoint → Paymaster:
  validatePaymasterUserOp(UserOp, userOpHash, maxCost)

Paymaster → EAS:
  getAttestation(attUid)

Paymaster checks:
  ✓ Attestation exists
  ✓ Attester matches
  ✓ PolicyHash matches
  ✓ Epoch valid
  ✓ Cap not exceeded
  ✓ Nullifier unused

Paymaster → EntryPoint:
  (context, validAfter, validUntil)

EntryPoint executes call if valid
```

### 3. Payment Execution

```
EntryPoint → SmartAccount:
  execute(target, value, data)

SmartAccount → DollarRouter:
  swapToUSDC(USDT, 100, 99, merchant)

DollarRouter → Uniswap:
  swap(USDT → USDC)

Uniswap → Merchant:
  transfer(USDC, 99.5)

Merchant → MerchantReceipts:
  emitReceipt(payer, merchant, amounts, nullifierHash, epoch, policyHash)

MerchantReceipts emits Receipt event
```

## Deployment

### Testnet Deployment Order

1. **Deploy EAS or MockEAS** (if using real EAS, skip)
2. **Deploy CompliancePaymaster**
   - Args: (entryPoint, eas, schemaUID, attester)
   - Fund with ETH for gas sponsorship
3. **Deploy DollarRouter**
   - Args: (canonicalUSDC, swapRouter)
   - Set token allowlist
4. **Deploy MerchantReceipts**
   - No constructor args
5. **Deploy KYCRegistry** (optional)
   - Set initial Merkle roots
6. **Configure Agent Runner**
   - Set paymaster address
   - Set EAS endpoint
   - Set attester private key
7. **Deploy Starknet Contracts** (optional)
   - Build with `scarb build`
   - Deploy with `starkli deploy`

### Mainnet Considerations

- **Audit:** Formal security audit required
- **Timelock:** Add timelock for upgrades
- **Multi-sig:** Use Gnosis Safe for owner
- **Gas Optimization:** Review gas reports
- **Oracle Selection:** Use Chainlink for production
- **Monitoring:** Set up Tenderly alerts
- **Insurance:** Consider Nexus Mutual coverage

## Gas Optimization

### Techniques Applied

1. **Custom Errors:** Gas-efficient reverts
2. **Unchecked Math:** Where overflow impossible
3. **Calldata over Memory:** Function parameters
4. **Packed Storage:** Struct optimization
5. **Minimal Proxy:** For factory patterns (future)
6. **Batch Operations:** Multi-call support (future)

### Gas Benchmarks (Foundry)

Run `forge test --gas-report` for detailed analysis:
```
| Contract            | Function         | Gas   |
|---------------------|------------------|-------|
| CompliancePaymaster | validatePaymaster| ~80k  |
| DollarRouter        | swapToUSDC       | ~120k |
| MerchantReceipts    | emitReceipt      | ~30k  |
```

## Testing Strategy

### Test Layers

1. **Unit Tests** (Foundry)
   - Individual function testing
   - Edge case coverage
   - Reversion testing
   - Event emission validation

2. **Fuzz Tests** (Foundry)
   - Property-based testing
   - Random input validation
   - Invariant testing

3. **Integration Tests**
   - Full flow testing
   - Multi-contract interactions
   - UserOp end-to-end

4. **Static Analysis** (Slither)
   - Vulnerability detection
   - Code quality checks
   - Gas optimizations

5. **Property Testing** (Echidna - future)
   - Invariant fuzzing
   - State machine testing

### Running Tests

```bash
# Unit tests
forge test

# With gas reporting
forge test --gas-report

# With coverage
forge coverage

# Specific test
forge test --match-contract CompliancePaymasterTest

# Verbose output
forge test -vvv
```

## Roadmap

### Phase 1: MVP (Current)
- ✅ Core contracts (Paymaster, Router, Receipts)
- ✅ MockEAS for testing
- ✅ Agent runner
- ✅ Client UserOp sender
- ✅ Starknet Policy Guard

### Phase 2: ZK Integration
- [ ] Replace attestations with ZK proofs
- [ ] SNARKs for policy verification
- [ ] Private nullifiers via ZK
- [ ] ZK-KYC integration

### Phase 3: Production Hardening
- [ ] Formal audit (Trail of Bits / OpenZeppelin)
- [ ] Multi-chain deployment (Polygon, Base, Arbitrum)
- [ ] Real EAS integration
- [ ] Chainlink price feeds
- [ ] Timelock upgrades

### Phase 4: Advanced Features
- [ ] Multi-token support (not just stables)
- [ ] Subscription payments
- [ ] Recurring payment rails
- [ ] SDK for merchants
- [ ] Dashboard UI

## References

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Ethereum Attestation Service](https://attest.sh/)
- [Pimlico Bundler Docs](https://docs.pimlico.io/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Starknet Docs](https://book.starknet.io/)

---

**Last Updated:** 2025-11-06
**Version:** 0.1.0 (MVP)
