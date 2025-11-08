/**
 * @file transactionBuilder.ts
 * @description Builds and validates transactions for ERC-4337 UserOps
 */

import { PaymentRequest, TransactionPlan, AgentConfig } from './types.js';
import { Logger } from './logger.js';
import { encodeFunctionData, parseAbi, keccak256, toHex } from 'viem';

export class TransactionBuilder {
  private config: AgentConfig;
  private logger: Logger;

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Build a transaction plan for a payment request
   */
  async buildPlan(request: PaymentRequest, epoch: number): Promise<TransactionPlan> {
    // Build the callData for merchant payment
    const callData = this.encodePaymentCall(request);

    // Calculate mock userOpHash (in production, this comes from the actual UserOp)
    const userOpHash = this.calculateUserOpHash(request, callData);

    // Calculate policy hash
    const policyHash = keccak256(
      Buffer.concat([
        Buffer.from(userOpHash.slice(2), 'hex'),
        this.u256ToBytes(BigInt(epoch)),
      ])
    );

    // Estimate gas (simplified for MVP)
    const gasEstimate = await this.estimateGas(request);

    const plan: TransactionPlan = {
      userOpHash,
      callData,
      target: request.merchant,
      value: 0n, // Token transfers have 0 ETH value
      gasEstimate,
      policyHash,
      epoch,
    };

    this.logger.debug('Transaction plan built', plan);
    return plan;
  }

  /**
   * Encode payment function call
   */
  private encodePaymentCall(request: PaymentRequest): string {
    // Encoding a call to emitReceipt or similar merchant function
    const abi = parseAbi([
      'function emitReceipt(address payer, address merchant, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, bytes32 nullifierHash, uint256 epoch, bytes32 policyHash)',
    ]);

    // For MVP, we're calling the MerchantReceipts contract
    const callData = encodeFunctionData({
      abi,
      functionName: 'emitReceipt',
      args: [
        ('0x' + '0'.repeat(40)) as `0x${string}`, // payer (would be smart account)
        request.merchant as `0x${string}`,
        request.tokenIn as `0x${string}`,
        request.tokenIn as `0x${string}`, // tokenOut same as tokenIn for now
        request.amountIn,
        request.amountIn,
        keccak256(toHex(JSON.stringify(request.metadata || {}))), // nullifier from metadata
        BigInt(Date.now().toString().slice(0, 6)), // epoch
        ('0x' + '0'.repeat(64)) as `0x${string}`, // policyHash placeholder
      ],
    });

    return callData;
  }

  /**
   * Calculate userOpHash (simplified for MVP)
   */
  private calculateUserOpHash(request: PaymentRequest, callData: string): string {
    // In production, this comes from the actual UserOperation
    // For MVP, we hash the key parameters
    return keccak256(
      Buffer.concat([
        Buffer.from(request.merchant.slice(2), 'hex'),
        Buffer.from(request.tokenIn.slice(2), 'hex'),
        this.u256ToBytes(request.amountIn),
        Buffer.from(callData.slice(2), 'hex'),
      ])
    );
  }

  /**
   * Estimate gas for the transaction
   */
  private async estimateGas(request: PaymentRequest): Promise<bigint> {
    // Simplified gas estimation
    // In production, this would call eth_estimateGas

    const baseGas = 21000n; // Base transaction gas
    const callGas = 100000n; // Estimated gas for contract call
    const paymasterGas = 50000n; // Extra gas for paymaster validation

    return baseGas + callGas + paymasterGas;
  }

  /**
   * Validate transaction parameters
   */
  validate(plan: TransactionPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check gas estimate is reasonable
    if (plan.gasEstimate > 1000000n) {
      errors.push(`Gas estimate too high: ${plan.gasEstimate}`);
    }

    if (plan.gasEstimate === 0n) {
      errors.push('Gas estimate cannot be zero');
    }

    // Check addresses
    if (!this.isValidAddress(plan.target)) {
      errors.push(`Invalid target address: ${plan.target}`);
    }

    // Check hashes
    if (!plan.userOpHash.startsWith('0x') || plan.userOpHash.length !== 66) {
      errors.push(`Invalid userOpHash format: ${plan.userOpHash}`);
    }

    if (!plan.policyHash.startsWith('0x') || plan.policyHash.length !== 66) {
      errors.push(`Invalid policyHash format: ${plan.policyHash}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private u256ToBytes(n: bigint): Buffer {
    const b = Buffer.alloc(32);
    let x = n;
    for (let i = 31; i >= 0; i--) {
      b[i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return b;
  }

  /**
   * Format transaction for display
   */
  formatPlan(plan: TransactionPlan): string {
    return `
Transaction Plan:
  Target: ${plan.target}
  Value: ${plan.value} wei
  Gas Estimate: ${plan.gasEstimate}
  UserOp Hash: ${plan.userOpHash}
  Policy Hash: ${plan.policyHash}
  Epoch: ${plan.epoch}
  CallData Length: ${plan.callData.length} bytes
    `.trim();
  }
}

export default TransactionBuilder;
