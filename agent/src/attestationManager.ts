/**
 * @file attestationManager.ts
 * @description Manages attestation creation and verification
 */

import { Attestation, AgentConfig, TransactionPlan } from './types.js';
import { Logger } from './logger.js';
import { keccak256, encodePacked, toHex } from 'viem';

export class AttestationManager {
  private config: AgentConfig;
  private logger: Logger;

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Create an attestation for a transaction
   */
  async createAttestation(
    plan: TransactionPlan,
    modelId: string,
    prompt: string,
    planDescription: string
  ): Promise<Attestation> {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const expiration = now + 3600n; // 1 hour expiration

    // Hash the attestation data
    const attestationData = this.encodeAttestationData({
      modelId,
      prompt,
      planDescription,
      userOpHash: plan.userOpHash,
      policyHash: plan.policyHash,
      epoch: plan.epoch,
    });

    // For MVP, generate a mock UID
    // In production, this would call EAS contract
    const uid = keccak256(
      encodePacked(
        ['bytes32', 'address', 'uint64'],
        [attestationData, this.config.paymasterAddress as `0x${string}`, now]
      )
    );

    const attestation: Attestation = {
      uid,
      schema: this.config.schemaUID,
      attester: this.config.paymasterAddress, // In production, use actual attester
      recipient: plan.target,
      time: now,
      expirationTime: expiration,
      revocable: true,
      refUID: '0x' + '0'.repeat(64),
      data: attestationData,
    };

    this.logger.info('Attestation created', {
      uid: attestation.uid,
      recipient: attestation.recipient,
    });

    return attestation;
  }

  /**
   * Encode attestation data following the schema
   */
  private encodeAttestationData(data: {
    modelId: string;
    prompt: string;
    planDescription: string;
    userOpHash: string;
    policyHash: string;
    epoch: number;
  }): `0x${string}` {
    // Hash individual components
    const modelHash = keccak256(toHex(data.modelId));
    const promptHash = keccak256(toHex(data.prompt));
    const planHash = keccak256(toHex(data.planDescription));

    // Combine all data
    return keccak256(
      encodePacked(
        ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
        [modelHash, promptHash, planHash, data.userOpHash as `0x${string}`, data.policyHash as `0x${string}`, BigInt(data.epoch)]
      )
    );
  }

  /**
   * Verify an attestation is valid
   */
  async verifyAttestation(attestation: Attestation): Promise<boolean> {
    const now = BigInt(Math.floor(Date.now() / 1000));

    // Check expiration
    if (attestation.expirationTime > 0n && attestation.expirationTime < now) {
      this.logger.warn('Attestation expired', { uid: attestation.uid });
      return false;
    }

    // Check schema matches
    if (attestation.schema !== this.config.schemaUID) {
      this.logger.warn('Schema mismatch', {
        expected: this.config.schemaUID,
        got: attestation.schema,
      });
      return false;
    }

    this.logger.debug('Attestation verified', { uid: attestation.uid });
    return true;
  }

  /**
   * Build paymasterAndData bytes
   */
  buildPaymasterAndData(attestation: Attestation, policyHash: string, epoch: number): `0x${string}` {
    // paymasterAndData = paymaster (20 bytes) || abi.encode(attUid, policyHash, epoch)
    const encoded = encodePacked(
      ['address', 'bytes32', 'bytes32', 'uint256'],
      [
        this.config.paymasterAddress as `0x${string}`,
        attestation.uid as `0x${string}`,
        policyHash as `0x${string}`,
        BigInt(epoch),
      ]
    );

    this.logger.debug('Built paymasterAndData', { length: encoded.length });
    return encoded;
  }

  /**
   * Calculate policy hash from userOpHash and epoch
   */
  calculatePolicyHash(userOpHash: string, epoch: number): `0x${string}` {
    return keccak256(
      encodePacked(['bytes32', 'uint256'], [userOpHash as `0x${string}`, BigInt(epoch)])
    );
  }
}

export default AttestationManager;
