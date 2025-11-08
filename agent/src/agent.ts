/**
 * @file agent.ts
 * @description Main zkAgent Rails orchestrator
 */

import { AgentConfig, PaymentRequest, AgentAnalysis } from './types.js';
import { ConfigManager } from './config.js';
import { Logger } from './logger.js';
import { PolicyValidator } from './policyValidator.js';
import { RiskAnalyzer } from './riskAnalyzer.js';
import { AttestationManager } from './attestationManager.js';
import { TransactionBuilder } from './transactionBuilder.js';

export class zkAgent {
  private config: AgentConfig;
  private logger: Logger;
  private policyValidator: PolicyValidator;
  private riskAnalyzer: RiskAnalyzer;
  private attestationManager: AttestationManager;
  private transactionBuilder: TransactionBuilder;

  constructor(configPath?: string, verbose = false) {
    const configManager = new ConfigManager(configPath);
    this.config = configManager.getConfig();

    this.logger = new Logger(undefined, verbose);
    this.policyValidator = new PolicyValidator(this.config, this.logger);
    this.riskAnalyzer = new RiskAnalyzer(this.logger);
    this.attestationManager = new AttestationManager(this.config, this.logger);
    this.transactionBuilder = new TransactionBuilder(this.config, this.logger);

    this.logger.info('zkAgent initialized', {
      chainId: this.config.chainId,
      modelId: this.config.modelId,
    });
  }

  /**
   * Process a payment request end-to-end
   */
  async processPayment(
    request: PaymentRequest,
    options: {
      modelId?: string;
      prompt?: string;
      planDescription?: string;
      epoch?: number;
      skipRiskAnalysis?: boolean;
    } = {}
  ): Promise<AgentAnalysis> {
    this.logger.info('Processing payment request', {
      merchant: request.merchant,
      amount: request.amountIn.toString(),
    });

    const startTime = Date.now();

    try {
      // 1. Validate configuration
      const configValidation = this.validateConfiguration();
      if (!configValidation.valid) {
        throw new Error(`Configuration invalid: ${configValidation.errors.join(', ')}`);
      }

      // 2. Build transaction plan
      const epoch = options.epoch || parseInt(Date.now().toString().slice(0, 6));
      const transactionPlan = await this.transactionBuilder.buildPlan(request, epoch);

      // Validate transaction plan
      const planValidation = this.transactionBuilder.validate(transactionPlan);
      if (!planValidation.valid) {
        throw new Error(`Transaction plan invalid: ${planValidation.errors.join(', ')}`);
      }

      // 3. Policy validation
      const policyValidation = await this.policyValidator.validate(request, epoch);

      if (!policyValidation.valid) {
        this.logger.warn('Policy validation failed', {
          violations: policyValidation.violations,
        });
      }

      // 4. Risk analysis
      let decision;
      if (options.skipRiskAnalysis) {
        decision = {
          approved: policyValidation.valid,
          reason: policyValidation.valid ? 'Policy valid, risk analysis skipped' : 'Policy validation failed',
          riskScore: 0,
          confidence: 1,
          flags: [],
        };
      } else {
        decision = await this.riskAnalyzer.analyze(request, policyValidation.valid);
      }

      // 5. Create attestation (if approved)
      let attestation;
      if (decision.approved) {
        attestation = await this.attestationManager.createAttestation(
          transactionPlan,
          options.modelId || this.config.modelId,
          options.prompt || `Pay ${request.merchant} ${request.amountIn} of ${request.tokenIn}`,
          options.planDescription || request.description
        );

        // Verify attestation
        const attestationValid = await this.attestationManager.verifyAttestation(attestation);
        if (!attestationValid) {
          throw new Error('Attestation verification failed');
        }

        // Record spending if approved
        this.policyValidator.recordSpending(epoch, request.amountIn);
      }

      const analysis: AgentAnalysis = {
        request,
        decision,
        policyValidation,
        transactionPlan,
        attestation,
        timestamp: startTime,
      };

      const duration = Date.now() - startTime;
      this.logger.info('Payment processing complete', {
        approved: decision.approved,
        riskScore: decision.riskScore,
        duration: `${duration}ms`,
      });

      return analysis;
    } catch (error) {
      this.logger.error('Payment processing failed', error);
      throw error;
    }
  }

  /**
   * Quick approve check without full processing
   */
  async quickCheck(request: PaymentRequest): Promise<boolean> {
    const epoch = parseInt(Date.now().toString().slice(0, 6));
    const policyValidation = await this.policyValidator.validate(request, epoch);
    const decision = await this.riskAnalyzer.analyze(request, policyValidation.valid);

    return decision.approved;
  }

  /**
   * Get agent status and statistics
   */
  getStatus(): {
    config: AgentConfig;
    epochSpending: Record<number, string>;
    logs: number;
  } {
    const currentEpoch = parseInt(Date.now().toString().slice(0, 6));

    return {
      config: this.config,
      epochSpending: {
        [currentEpoch]: this.policyValidator.getEpochSpending(currentEpoch).toString(),
      },
      logs: this.logger.getLogs().length,
    };
  }

  /**
   * Export analysis to file
   */
  exportAnalysis(analysis: AgentAnalysis, path: string): void {
    const fs = require('fs');
    fs.writeFileSync(path, JSON.stringify(analysis, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));
    this.logger.info('Analysis exported', { path });
  }

  /**
   * Build paymasterAndData for UserOp
   */
  buildPaymasterData(analysis: AgentAnalysis): string {
    if (!analysis.attestation) {
      throw new Error('No attestation available');
    }

    return this.attestationManager.buildPaymasterAndData(
      analysis.attestation,
      analysis.transactionPlan.policyHash,
      analysis.transactionPlan.epoch
    );
  }

  private validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.paymasterAddress) {
      errors.push('Paymaster address not configured');
    }

    if (!this.config.rpcUrl) {
      errors.push('RPC URL not configured');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Accessor methods
  getLogger(): Logger {
    return this.logger;
  }

  getRiskAnalyzer(): RiskAnalyzer {
    return this.riskAnalyzer;
  }

  getPolicyValidator(): PolicyValidator {
    return this.policyValidator;
  }
}

export default zkAgent;
