/**
 * @file types.ts
 * @description Type definitions for zkAgent Rails agent system
 */

export interface AgentConfig {
  // Network configuration
  chainId: number;
  rpcUrl: string;
  bundlerUrl: string;

  // Contract addresses
  paymasterAddress: string;
  easAddress: string;
  entryPointAddress: string;

  // Agent configuration
  modelId: string;
  maxGasPrice: bigint;
  maxTransactionValue: bigint;

  // Policy configuration
  defaultEpoch: number;
  allowedTokens: string[];
  allowedMerchants: string[];

  // Attestation configuration
  attesterPrivateKey?: string;
  schemaUID: string;
}

export interface PaymentRequest {
  merchant: string;
  tokenIn: string;
  amountIn: bigint;
  description: string;
  metadata?: Record<string, any>;
}

export interface AgentDecision {
  approved: boolean;
  reason: string;
  riskScore: number; // 0-100
  confidence: number; // 0-1
  flags: string[];
  suggestedAction?: string;
}

export interface PolicyValidation {
  valid: boolean;
  violations: string[];
  warnings: string[];
  capRemaining: bigint;
  epochValid: boolean;
}

export interface Attestation {
  uid: string;
  schema: string;
  attester: string;
  recipient: string;
  time: bigint;
  expirationTime: bigint;
  revocable: boolean;
  refUID: string;
  data: string;
}

export interface TransactionPlan {
  userOpHash: string;
  callData: string;
  target: string;
  value: bigint;
  gasEstimate: bigint;
  policyHash: string;
  epoch: number;
}

export interface AgentAnalysis {
  request: PaymentRequest;
  decision: AgentDecision;
  policyValidation: PolicyValidation;
  transactionPlan: TransactionPlan;
  attestation?: Attestation;
  timestamp: number;
}

export interface RiskFactors {
  merchantUnknown: boolean;
  tokenUnknown: boolean;
  amountUnusual: boolean;
  gasUnusual: boolean;
  recentFailures: number;
  velocityExceeded: boolean;
}

export interface MerchantInfo {
  address: string;
  name?: string;
  verified: boolean;
  riskScore: number;
  transactionCount: number;
  lastSeen?: number;
}

export enum AgentAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REVIEW = 'REVIEW',
  ESCALATE = 'ESCALATE'
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: number;
  message: string;
  data?: any;
}
