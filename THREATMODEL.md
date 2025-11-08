# THREATMODEL — zkAgent Rails MVP

## Assets
- Sponsored gas funds in Paymaster.
- Merchant stablecoin payouts (USDC).
- Policy gating (allow-list, spend caps, epoch rate limit).
- Attestation integrity (agent-run attestation / zk-policy proof).
- KYC/SSI membership integrity (optional).

## Trust Assumptions
- For MVP, we trust an **attester key** (EAS attester or allow-listed signer) who publishes an attestation per agent run.
- Merchant price execution via DEX adapter honors slippage guard; price manipulation is out of scope for MVP.
- KYC/SSI: demo issuer publishes a Merkle root; in MVP you do **not** onboard real PII.

## Invariants
- No sponsorship without a valid attestation bound to `userOpHash` **and** within epoch & cap limits.
- Router only swaps **allow-listed tokens** to **USDC**, within `amountOutMin`.
- Receipts emitted for every successful pay; contain hashed nullifier only.

## Abuse Cases & Mitigations
- **Spam/DoS on paymaster** → epoch nullifier to limit sponsored calls per zkID/attestation; per-epoch budget.
- **Forged attestation** → whitelist attester(s); verify schema/expiry/revocation (if using EAS); bind hash to calldata.
- **Policy bypass** → hash over `(merchant, amount, epoch, userOpHash)` inside attestation; re-derive on-chain.
- **Slippage/routing risk** → `amountOutMin` guard; allow-list tokens and routers.
- **Reentrancy** → CEI pattern, `nonReentrant` where state mutates.
- **Upgrade/config risk** → events for every config change; 2-step owner handover; timelock (post-MVP).
