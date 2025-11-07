# Server (Backend API)

Lightweight Express.js server for handling agent requests and orchestrating UserOp construction.

## Setup

```bash
npm install
```

## Run

```bash
node index.mjs
```

The server will start on the configured port (default: 3000).

## Endpoints

Check `index.mjs` for available API routes. Typically includes:
- Agent attestation verification
- UserOp construction helpers
- Policy validation

## Integration

This server can act as a bridge between:
- Your agent runner (provides attestations)
- The client (sends UserOps)
- On-chain contracts (validates and executes)
