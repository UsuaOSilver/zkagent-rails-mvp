# Agent Runner (MVP)

Produces a `policyHash` and input fields you can drop into your Paymaster's `paymasterAndData` encoding.
Later, replace with a real EAS attestation or a zk-policy proof.

```bash
npm i
npm run build
node dist/runner.js --model gpt-4o-mini --prompt "Buy coffee" --plan "Pay Cafe BA" --callDataHash 0xabc123... --epoch 202511
```
