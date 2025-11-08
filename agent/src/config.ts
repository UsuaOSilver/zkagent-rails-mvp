/**
 * @file config.ts
 * @description Configuration management for zkAgent Rails
 */

import { AgentConfig } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

export class ConfigManager {
  private config: AgentConfig;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }

  private loadConfig(configPath?: string): AgentConfig {
    // Try to load from file
    if (configPath && fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return this.mergeWithEnv(fileConfig);
    }

    // Load from environment variables
    return this.loadFromEnv();
  }

  private loadFromEnv(): AgentConfig {
    return {
      chainId: parseInt(process.env.CHAIN_ID || '84532'), // Base Sepolia
      rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
      bundlerUrl: process.env.BUNDLER_URL || '',
      paymasterAddress: process.env.PAYMASTER_ADDRESS || '',
      easAddress: process.env.EAS_ADDRESS || '',
      entryPointAddress: process.env.ENTRY_POINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      modelId: process.env.MODEL_ID || 'gpt-4o-mini',
      maxGasPrice: BigInt(process.env.MAX_GAS_PRICE || '100000000000'), // 100 gwei
      maxTransactionValue: BigInt(process.env.MAX_TX_VALUE || '1000000000000000000'), // 1 ETH equivalent
      defaultEpoch: parseInt(process.env.DEFAULT_EPOCH || Date.now().toString().slice(0, 6)),
      allowedTokens: (process.env.ALLOWED_TOKENS || '').split(',').filter(Boolean),
      allowedMerchants: (process.env.ALLOWED_MERCHANTS || '').split(',').filter(Boolean),
      attesterPrivateKey: process.env.ATTESTER_PRIVATE_KEY,
      schemaUID: process.env.SCHEMA_UID || '0x' + '0'.repeat(64),
    };
  }

  private mergeWithEnv(fileConfig: Partial<AgentConfig>): AgentConfig {
    const envConfig = this.loadFromEnv();
    return { ...envConfig, ...fileConfig };
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.paymasterAddress || this.config.paymasterAddress.length !== 42) {
      errors.push('Invalid paymaster address');
    }

    if (!this.config.rpcUrl) {
      errors.push('RPC URL is required');
    }

    if (this.config.maxGasPrice <= 0n) {
      errors.push('Max gas price must be positive');
    }

    if (this.config.maxTransactionValue <= 0n) {
      errors.push('Max transaction value must be positive');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  saveConfig(outputPath: string): void {
    const configToSave = { ...this.config };
    // Remove sensitive data
    delete configToSave.attesterPrivateKey;

    fs.writeFileSync(outputPath, JSON.stringify(configToSave, null, 2));
  }
}

export default ConfigManager;
