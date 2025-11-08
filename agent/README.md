# zkAgent Rails - Agent Module

**Verifiable AI agent for compliant on-chain payments**

The agent module provides intelligent analysis, policy enforcement, and risk assessment for ERC-4337 UserOperations. It generates verifiable attestations that the CompliancePaymaster validates before sponsoring gas.

## Features

### 🤖 Intelligent Analysis
- Multi-layered decision making
- Risk scoring (0-100 scale)
- Confidence metrics
- Anomaly detection

### 🛡️ Policy Enforcement
- Token allowlists
- Merchant allowlists
- Per-epoch spending caps
- Transaction value limits
- Velocity checks

### 📊 Risk Assessment
- Merchant reputation tracking
- Transaction pattern analysis
- Statistical anomaly detection
- Historical analysis

### 🔐 Attestation Management
- EAS-compatible attestations
- Policy hash generation
- Epoch-based validation
- Expiration handling

### 📝 Comprehensive Logging
- Structured logging
- Verbose mode
- Export capabilities
- Audit trails

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    zkAgent                          │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Config    │  │    Logger    │  │  Policy   │ │
│  │   Manager   │  │              │  │ Validator │ │
│  └─────────────┘  └──────────────┘  └───────────┘ │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │    Risk     │  │ Attestation  │  │Transaction│ │
│  │  Analyzer   │  │   Manager    │  │  Builder  │ │
│  └─────────────┘  └──────────────┘  └───────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  AgentAnalysis   │
              │  - Decision      │
              │  - Attestation   │
              │  - Transaction   │
              └──────────────────┘
```

## Installation

```bash
cd agent
npm install
npm run build
```

## Quick Start

### CLI Usage

```bash
# Process a payment
npx zkagent process \
  --merchant 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \
  --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --amount 1000000 \
  --description "Buy coffee" \
  --output analysis.json \
  --verbose

# Quick approval check
npx zkagent check \
  --merchant 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \
  --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --amount 1000000

# Show agent status
npx zkagent status

# Register a trusted merchant
npx zkagent register-merchant \
  --address 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \
  --name "Coffee Shop BA" \
  --verified true \
  --risk-score 10

# Generate config template
npx zkagent config --template agent-config.json
```

### Programmatic Usage

```typescript
import { zkAgent, PaymentRequest } from '@zkagent/agent';

// Initialize agent
const agent = new zkAgent('./config.json', true);

// Create payment request
const request: PaymentRequest = {
  merchant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  amountIn: 1000000n, // 1 USDC
  description: 'Buy coffee',
};

// Process payment
const analysis = await agent.processPayment(request);

if (analysis.decision.approved) {
  // Get paymasterAndData for UserOp
  const paymasterData = agent.buildPaymasterData(analysis);
  console.log('Paymaster Data:', paymasterData);
} else {
  console.log('Rejected:', analysis.decision.reason);
}
```

## Configuration

### Environment Variables

```bash
# Network
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
BUNDLER_URL=https://api.pimlico.io/v2/base-sepolia/rpc

# Contracts
PAYMASTER_ADDRESS=0xYourPaymasterAddress
EAS_ADDRESS=0xYourEASAddress
ENTRY_POINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

# Agent
MODEL_ID=gpt-4o-mini
MAX_GAS_PRICE=100000000000
MAX_TX_VALUE=1000000000000000000
DEFAULT_EPOCH=202511

# Policy
ALLOWED_TOKENS=0xUSDC,0xUSDT,0xDAI
ALLOWED_MERCHANTS=0xMerchant1,0xMerchant2

# Security
ATTESTER_PRIVATE_KEY=0xYourPrivateKey
SCHEMA_UID=0x...
```

### Config File

```json
{
  "chainId": 84532,
  "rpcUrl": "https://sepolia.base.org",
  "bundlerUrl": "https://api.pimlico.io/v2/base-sepolia/rpc",
  "paymasterAddress": "0xYourPaymasterAddress",
  "easAddress": "0xYourEASAddress",
  "entryPointAddress": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  "modelId": "gpt-4o-mini",
  "maxGasPrice": "100000000000",
  "maxTransactionValue": "1000000000000000000",
  "defaultEpoch": 202511,
  "allowedTokens": [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  ],
  "allowedMerchants": [],
  "schemaUID": "0x..."
}
```

## Decision Logic

### Risk Scoring

| Factor | Impact | Description |
|--------|--------|-------------|
| Policy violation | +100 | Auto-reject |
| Unknown merchant | +20 | Not in database |
| Unknown token | +15 | Not in common list |
| Unusual amount | +25 | Statistical outlier |
| High velocity | +30 | Too many recent tx |
| Recent failures | +10 each | Previous failed tx |

### Approval Thresholds

- **< 30**: Low risk - Auto approve
- **30-60**: Medium risk - Approve with monitoring
- **60-80**: High risk - Requires review
- **> 80**: Very high risk - Auto reject

## Examples

### Basic Payment Processing

```typescript
const agent = new zkAgent();

const request = {
  merchant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  amountIn: 1000000n,
  description: 'Coffee',
};

const analysis = await agent.processPayment(request);
```

### Batch Processing

```typescript
const requests = [...]; // Multiple payment requests

const results = await Promise.all(
  requests.map(req => agent.processPayment(req))
);

const approved = results.filter(r => r.decision.approved);
```

### Merchant Management

```typescript
agent.getRiskAnalyzer().registerMerchant({
  address: '0x...',
  name: 'Coffee Shop',
  verified: true,
  riskScore: 10,
  transactionCount: 0,
});
```

### Export Analysis

```typescript
agent.exportAnalysis(analysis, 'payment-analysis.json');
```

## API Reference

### zkAgent

Main agent class that orchestrates all operations.

**Constructor:**
```typescript
new zkAgent(configPath?: string, verbose?: boolean)
```

**Methods:**
- `processPayment(request, options?)` - Full payment analysis
- `quickCheck(request)` - Fast approval check
- `getStatus()` - Get agent statistics
- `buildPaymasterData(analysis)` - Generate paymasterAndData
- `exportAnalysis(analysis, path)` - Export to file

### PaymentRequest

```typescript
interface PaymentRequest {
  merchant: string;        // Merchant address
  tokenIn: string;         // Token address
  amountIn: bigint;        // Amount in wei
  description: string;     // Description
  metadata?: object;       // Optional metadata
}
```

### AgentAnalysis

```typescript
interface AgentAnalysis {
  request: PaymentRequest;
  decision: AgentDecision;
  policyValidation: PolicyValidation;
  transactionPlan: TransactionPlan;
  attestation?: Attestation;
  timestamp: number;
}
```

## Development

### Run Examples

```bash
# Basic usage
npm run example:basic

# Advanced patterns
npm run example:advanced
```

### Testing

```bash
npm run typecheck  # Type checking
npm run lint      # Linting
npm run format    # Format code
```

### Watch Mode

```bash
npm run dev  # Watch and rebuild
```

## Security Considerations

1. **Never commit private keys** - Use environment variables
2. **Validate all inputs** - The agent validates but double-check
3. **Monitor spending** - Check epoch caps regularly
4. **Review rejections** - Investigate high-risk transactions
5. **Audit trail** - Keep logs for compliance

## Troubleshooting

### Common Issues

**"Configuration invalid"**
- Check all required environment variables are set
- Validate addresses are checksummed

**"Policy validation failed"**
- Check token/merchant allowlists
- Verify epoch is current
- Check spending caps

**"Transaction would be rejected"**
- Review risk score and flags
- Check merchant reputation
- Verify amount is reasonable

### Debug Mode

```bash
# Enable verbose logging
npx zkagent process --merchant 0x... --verbose

# Or programmatically
const agent = new zkAgent(undefined, true);
```

## Migration from Old Agent

Old agent (v0.1):
```bash
node dist/runner.js \
  --model gpt-4o-mini \
  --prompt "Pay merchant" \
  --plan "Buy coffee" \
  --callDataHash 0x... \
  --epoch 202511
```

New agent (v1.0):
```bash
npx zkagent process \
  --merchant 0x... \
  --token 0x... \
  --amount 1000000 \
  --description "Buy coffee" \
  --model gpt-4o-mini
```

See `examples/` for full migration patterns.

## Contributing

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [`../LICENSE`](../LICENSE) for details.

---

**Version:** 1.0.0
**Status:** Production Ready
**Last Updated:** 2025-11-06
