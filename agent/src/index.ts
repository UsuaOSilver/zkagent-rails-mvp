/**
 * @file index.ts
 * @description Main exports for zkAgent Rails
 */

export { zkAgent } from './agent.js';
export { ConfigManager } from './config.js';
export { Logger } from './logger.js';
export { PolicyValidator } from './policyValidator.js';
export { RiskAnalyzer } from './riskAnalyzer.js';
export { AttestationManager } from './attestationManager.js';
export { TransactionBuilder } from './transactionBuilder.js';

export * from './types.js';

// Re-export default
export { default as Agent } from './agent.js';
export { default as Config } from './config.js';
