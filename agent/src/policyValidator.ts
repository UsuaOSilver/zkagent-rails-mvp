/**
 * @file policyValidator.ts
 * @description Policy validation and compliance checking
 */

import { AgentConfig, PaymentRequest, PolicyValidation } from './types.js';
import { Logger } from './logger.js';

export class PolicyValidator {
  private config: AgentConfig;
  private logger: Logger;

  // Track spending per epoch (in-memory for MVP, should be persistent in production)
  private epochSpending: Map<number, bigint> = new Map();

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async validate(request: PaymentRequest, epoch: number): Promise<PolicyValidation> {
    const violations: string[] = [];
    const warnings: string[] = [];

    // 1. Token allowlist check
    if (this.config.allowedTokens.length > 0) {
      if (!this.config.allowedTokens.includes(request.tokenIn.toLowerCase())) {
        violations.push(`Token ${request.tokenIn} is not in allowlist`);
      }
    }

    // 2. Merchant allowlist check
    if (this.config.allowedMerchants.length > 0) {
      if (!this.config.allowedMerchants.includes(request.merchant.toLowerCase())) {
        violations.push(`Merchant ${request.merchant} is not in allowlist`);
      }
    }

    // 3. Amount check
    if (request.amountIn > this.config.maxTransactionValue) {
      violations.push(
        `Amount ${request.amountIn} exceeds max transaction value ${this.config.maxTransactionValue}`
      );
    }

    if (request.amountIn === 0n) {
      violations.push('Amount cannot be zero');
    }

    // 4. Epoch spending check
    const currentSpending = this.epochSpending.get(epoch) || 0n;
    const capRemaining = this.config.maxTransactionValue * 10n - currentSpending; // 10x max per epoch

    if (currentSpending + request.amountIn > this.config.maxTransactionValue * 10n) {
      violations.push(`Epoch spending limit exceeded. Remaining: ${capRemaining}`);
    }

    if (capRemaining < this.config.maxTransactionValue) {
      warnings.push(`Low epoch cap remaining: ${capRemaining}`);
    }

    // 5. Epoch validity check
    const currentEpoch = parseInt(Date.now().toString().slice(0, 6));
    const epochValid = Math.abs(epoch - currentEpoch) <= 1; // Allow current and next epoch

    if (!epochValid) {
      violations.push(`Invalid epoch ${epoch}. Current epoch: ${currentEpoch}`);
    }

    // 6. Address validation
    if (!this.isValidAddress(request.merchant)) {
      violations.push(`Invalid merchant address: ${request.merchant}`);
    }

    if (!this.isValidAddress(request.tokenIn)) {
      violations.push(`Invalid token address: ${request.tokenIn}`);
    }

    const validation: PolicyValidation = {
      valid: violations.length === 0,
      violations,
      warnings,
      capRemaining,
      epochValid,
    };

    this.logger.debug('Policy validation result', validation);

    return validation;
  }

  recordSpending(epoch: number, amount: bigint): void {
    const current = this.epochSpending.get(epoch) || 0n;
    this.epochSpending.set(epoch, current + amount);
    this.logger.info(`Recorded spending for epoch ${epoch}: ${amount}`);
  }

  getEpochSpending(epoch: number): bigint {
    return this.epochSpending.get(epoch) || 0n;
  }

  resetEpochSpending(epoch: number): void {
    this.epochSpending.delete(epoch);
    this.logger.info(`Reset spending for epoch ${epoch}`);
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // Advanced policy checks (can be extended)
  async checkVelocity(merchant: string, windowMs: number = 3600000): Promise<boolean> {
    // Check if too many transactions to same merchant in time window
    // This would require transaction history tracking
    // For MVP, return true
    return true;
  }

  async checkReputation(merchant: string): Promise<number> {
    // Check merchant reputation score (0-100)
    // This would integrate with reputation systems
    // For MVP, return default score
    return 50;
  }
}

export default PolicyValidator;
