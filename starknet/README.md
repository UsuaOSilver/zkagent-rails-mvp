# Starknet MVP

Minimal **Policy Guard** that lets a designated **attester** write allowed `(user, commitment)` pairs (e.g., hash over agent-run plan).
Your payment contract can `check_policy(user, commitment)` before allowing a transfer.

> This is intentionally simple to let you qualify for "live MVP on Starknet" today. Replace with a real paymaster / plugin later.

## Build
```bash
scarb build
```
## Deploy (example with starkli)
```bash
# declare and deploy policy_guard with <attester_felt>
starkli declare target/dev/policy_guard.sierra.json
starkli deploy <class_hash> <attester_felt_address>
```
