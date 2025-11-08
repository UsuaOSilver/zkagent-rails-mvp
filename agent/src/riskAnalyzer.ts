/**
 * @file riskAnalyzer.ts
 * @description Risk analysis and scoring for payment requests
 */

import { PaymentRequest, AgentDecision, RiskFactors, MerchantInfo, AgentAction } from './types.js';
import { Logger } from './logger.js';

export class RiskAnalyzer {
  private logger: Logger;
  private merchantDatabase: Map<string, MerchantInfo> = new Map();
  private transactionHistory: PaymentRequest[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async analyze(request: PaymentRequest, policyValid: boolean): Promise<AgentDecision> {
    const riskFactors = this.identifyRiskFactors(request);
    const riskScore = this.calculateRiskScore(riskFactors, policyValid);
    const confidence = this.calculateConfidence(request, riskFactors);

    const flags: string[] = [];
    if (riskFactors.merchantUnknown) flags.push('UNKNOWN_MERCHANT');
    if (riskFactors.tokenUnknown) flags.push('UNKNOWN_TOKEN');
    if (riskFactors.amountUnusual) flags.push('UNUSUAL_AMOUNT');
    if (riskFactors.velocityExceeded) flags.push('HIGH_VELOCITY');
    if (riskFactors.recentFailures > 0) flags.push('RECENT_FAILURES');

    let approved = false;
    let reason = '';
    let suggestedAction: string | undefined;

    // Decision logic based on risk score
    if (!policyValid) {
      approved = false;
      reason = 'Policy validation failed';
      suggestedAction = 'Fix policy violations and retry';
    } else if (riskScore < 30) {
      approved = true;
      reason = 'Low risk transaction';
    } else if (riskScore < 60) {
      approved = true;
      reason = 'Medium risk transaction - approved with monitoring';
      flags.push('REQUIRES_MONITORING');
    } else if (riskScore < 80) {
      approved = false;
      reason = 'High risk transaction - requires review';
      suggestedAction = 'Manual review required';
      flags.push('REQUIRES_REVIEW');
    } else {
      approved = false;
      reason = 'Very high risk transaction - rejected';
      suggestedAction = 'Transaction blocked due to high risk';
    }

    // Log the decision
    this.logger.info('Risk analysis complete', {
      merchant: request.merchant,
      riskScore,
      approved,
      reason,
    });

    // Record transaction for future analysis
    this.transactionHistory.push(request);
    if (this.transactionHistory.length > 1000) {
      this.transactionHistory = this.transactionHistory.slice(-1000);
    }

    return {
      approved,
      reason,
      riskScore,
      confidence,
      flags,
      suggestedAction,
    };
  }

  private identifyRiskFactors(request: PaymentRequest): RiskFactors {
    const merchant = this.merchantDatabase.get(request.merchant.toLowerCase());

    return {
      merchantUnknown: !merchant,
      tokenUnknown: this.isUnknownToken(request.tokenIn),
      amountUnusual: this.isUnusualAmount(request.amountIn),
      gasUnusual: false, // Would check gas estimates
      recentFailures: this.getRecentFailures(request.merchant),
      velocityExceeded: this.checkVelocity(request.merchant),
    };
  }

  private calculateRiskScore(factors: RiskFactors, policyValid: boolean): number {
    let score = 0;

    if (!policyValid) score += 100; // Auto-reject

    if (factors.merchantUnknown) score += 20;
    if (factors.tokenUnknown) score += 15;
    if (factors.amountUnusual) score += 25;
    if (factors.gasUnusual) score += 10;
    if (factors.velocityExceeded) score += 30;

    // Recent failures add cumulative risk
    score += factors.recentFailures * 10;

    return Math.min(score, 100);
  }

  private calculateConfidence(request: PaymentRequest, factors: RiskFactors): number {
    let confidence = 1.0;

    // Reduce confidence for unknown factors
    if (factors.merchantUnknown) confidence -= 0.2;
    if (factors.tokenUnknown) confidence -= 0.1;

    // Increase confidence with more data
    const merchant = this.merchantDatabase.get(request.merchant.toLowerCase());
    if (merchant && merchant.transactionCount > 10) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private isUnknownToken(token: string): boolean {
    // Common stablecoins
    const knownTokens = [
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
      '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    ];
    return !knownTokens.includes(token.toLowerCase());
  }

  private isUnusualAmount(amount: bigint): boolean {
    if (this.transactionHistory.length < 10) return false;

    const amounts = this.transactionHistory.map(tx => tx.amountIn);
    const avg = amounts.reduce((sum, a) => sum + a, 0n) / BigInt(amounts.length);
    const stdDev = this.calculateStdDev(amounts, avg);

    // Flag if amount is more than 2 standard deviations from mean
    return amount > avg + stdDev * 2n || amount < avg - stdDev * 2n;
  }

  private calculateStdDev(amounts: bigint[], avg: bigint): bigint {
    if (amounts.length === 0) return 0n;

    const squaredDiffs = amounts.map(a => {
      const diff = a > avg ? a - avg : avg - a;
      return diff * diff;
    });

    const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0n) / BigInt(amounts.length);

    // Approximation of square root
    return this.sqrt(avgSquaredDiff);
  }

  private sqrt(value: bigint): bigint {
    if (value < 0n) return 0n;
    if (value < 2n) return value;

    let x = value;
    let y = (x + 1n) / 2n;

    while (y < x) {
      x = y;
      y = (x + value / x) / 2n;
    }

    return x;
  }

  private getRecentFailures(merchant: string): number {
    // Check for recent failed transactions
    // For MVP, return 0
    return 0;
  }

  private checkVelocity(merchant: string): boolean {
    // Check if transaction velocity to this merchant is too high
    const recentToMerchant = this.transactionHistory.filter(
      tx => tx.merchant.toLowerCase() === merchant.toLowerCase()
    );

    // Flag if more than 5 transactions in last 10 transactions
    return recentToMerchant.length > 5;
  }

  registerMerchant(info: MerchantInfo): void {
    this.merchantDatabase.set(info.address.toLowerCase(), info);
    this.logger.info('Merchant registered', { address: info.address, name: info.name });
  }

  getMerchantInfo(address: string): MerchantInfo | undefined {
    return this.merchantDatabase.get(address.toLowerCase());
  }

  exportMerchantDatabase(path: string): void {
    const data = Array.from(this.merchantDatabase.entries());
    require('fs').writeFileSync(path, JSON.stringify(data, null, 2));
  }
}

export default RiskAnalyzer;
