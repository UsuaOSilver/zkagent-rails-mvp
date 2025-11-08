#!/usr/bin/env node
/**
 * @file cli.ts
 * @description Command-line interface for zkAgent Rails
 */

import { zkAgent } from './agent.js';
import { PaymentRequest, MerchantInfo } from './types.js';
import * as fs from 'fs';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseArgs(): {
  command: string;
  args: Record<string, string>;
  flags: Set<string>;
} {
  const command = process.argv[2] || 'help';
  const args: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = process.argv[i + 1];

      if (value && !value.startsWith('--')) {
        args[key] = value;
        i++; // Skip next arg since we consumed it
      } else {
        flags.add(key);
      }
    }
  }

  return { command, args, flags };
}

async function main() {
  const { command, args, flags } = parseArgs();
  const verbose = flags.has('verbose') || flags.has('v');

  try {
    switch (command) {
      case 'process':
        await processCommand(args, verbose);
        break;

      case 'check':
        await checkCommand(args, verbose);
        break;

      case 'status':
        await statusCommand(args, verbose);
        break;

      case 'register-merchant':
        await registerMerchantCommand(args, verbose);
        break;

      case 'config':
        await configCommand(args);
        break;

      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;

      default:
        log(`Unknown command: ${command}`, 'red');
        log('Run "zkagent help" for usage information', 'yellow');
        process.exit(1);
    }
  } catch (error) {
    log(`Error: ${(error as Error).message}`, 'red');
    if (verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function processCommand(args: Record<string, string>, verbose: boolean) {
  log('═══════════════════════════════════════', 'cyan');
  log('    zkAgent Rails - Payment Processing', 'bright');
  log('═══════════════════════════════════════', 'cyan');
  log('');

  // Validate required arguments
  const required = ['merchant', 'token', 'amount'];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing required argument: --${key}`);
    }
  }

  // Create payment request
  const request: PaymentRequest = {
    merchant: args.merchant,
    tokenIn: args.token,
    amountIn: BigInt(args.amount),
    description: args.description || 'Payment request',
    metadata: args.metadata ? JSON.parse(args.metadata) : {},
  };

  log('Payment Request:', 'blue');
  log(`  Merchant: ${request.merchant}`);
  log(`  Token: ${request.tokenIn}`);
  log(`  Amount: ${request.amountIn}`);
  log(`  Description: ${request.description}`);
  log('');

  // Initialize agent
  const agent = new zkAgent(args.config, verbose);

  // Process payment
  log('Processing...', 'yellow');
  const analysis = await agent.processPayment(request, {
    modelId: args.model,
    prompt: args.prompt,
    planDescription: args.plan,
    epoch: args.epoch ? parseInt(args.epoch) : undefined,
  });

  // Display results
  log('');
  log('═══════════════════════════════════════', 'cyan');
  log('             Analysis Results', 'bright');
  log('═══════════════════════════════════════', 'cyan');
  log('');

  // Decision
  const statusColor = analysis.decision.approved ? 'green' : 'red';
  const statusText = analysis.decision.approved ? '✓ APPROVED' : '✗ REJECTED';
  log(`Status: ${statusText}`, statusColor);
  log(`Reason: ${analysis.decision.reason}`);
  log(`Risk Score: ${analysis.decision.riskScore}/100`);
  log(`Confidence: ${(analysis.decision.confidence * 100).toFixed(1)}%`);

  if (analysis.decision.flags.length > 0) {
    log(`Flags: ${analysis.decision.flags.join(', ')}`, 'yellow');
  }

  if (analysis.decision.suggestedAction) {
    log(`Suggested Action: ${analysis.decision.suggestedAction}`, 'yellow');
  }

  log('');

  // Policy validation
  log('Policy Validation:', 'blue');
  log(`  Valid: ${analysis.policyValidation.valid ? '✓' : '✗'}`);
  log(`  Epoch Valid: ${analysis.policyValidation.epochValid ? '✓' : '✗'}`);
  log(`  Cap Remaining: ${analysis.policyValidation.capRemaining}`);

  if (analysis.policyValidation.violations.length > 0) {
    log('  Violations:', 'red');
    analysis.policyValidation.violations.forEach(v => log(`    - ${v}`, 'red'));
  }

  if (analysis.policyValidation.warnings.length > 0) {
    log('  Warnings:', 'yellow');
    analysis.policyValidation.warnings.forEach(w => log(`    - ${w}`, 'yellow'));
  }

  log('');

  // Transaction plan
  log('Transaction Plan:', 'blue');
  log(`  UserOp Hash: ${analysis.transactionPlan.userOpHash}`);
  log(`  Policy Hash: ${analysis.transactionPlan.policyHash}`);
  log(`  Epoch: ${analysis.transactionPlan.epoch}`);
  log(`  Gas Estimate: ${analysis.transactionPlan.gasEstimate}`);

  // Attestation
  if (analysis.attestation) {
    log('');
    log('Attestation:', 'blue');
    log(`  UID: ${analysis.attestation.uid}`);
    log(`  Expiration: ${new Date(Number(analysis.attestation.expirationTime) * 1000).toISOString()}`);

    // Build paymasterAndData
    const paymasterData = agent.buildPaymasterData(analysis);
    log('');
    log('Paymaster Data:', 'blue');
    log(`  ${paymasterData}`, 'cyan');
  }

  // Export option
  if (args.output) {
    agent.exportAnalysis(analysis, args.output);
    log('');
    log(`✓ Analysis exported to ${args.output}`, 'green');
  }

  log('');
  log('═══════════════════════════════════════', 'cyan');
}

async function checkCommand(args: Record<string, string>, verbose: boolean) {
  log('Quick Check...', 'cyan');

  const required = ['merchant', 'token', 'amount'];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing required argument: --${key}`);
    }
  }

  const request: PaymentRequest = {
    merchant: args.merchant,
    tokenIn: args.token,
    amountIn: BigInt(args.amount),
    description: args.description || 'Quick check',
  };

  const agent = new zkAgent(args.config, verbose);
  const approved = await agent.quickCheck(request);

  if (approved) {
    log('✓ Transaction would be APPROVED', 'green');
  } else {
    log('✗ Transaction would be REJECTED', 'red');
  }
}

async function statusCommand(args: Record<string, string>, verbose: boolean) {
  const agent = new zkAgent(args.config, verbose);
  const status = agent.getStatus();

  log('═══════════════════════════════════════', 'cyan');
  log('         zkAgent Rails Status', 'bright');
  log('═══════════════════════════════════════', 'cyan');
  log('');

  log('Configuration:', 'blue');
  log(`  Chain ID: ${status.config.chainId}`);
  log(`  Model: ${status.config.modelId}`);
  log(`  Paymaster: ${status.config.paymasterAddress}`);
  log(`  Max Gas Price: ${status.config.maxGasPrice}`);
  log(`  Max Transaction Value: ${status.config.maxTransactionValue}`);
  log('');

  log('Epoch Spending:', 'blue');
  Object.entries(status.epochSpending).forEach(([epoch, amount]) => {
    log(`  Epoch ${epoch}: ${amount}`);
  });
  log('');

  log(`Total Logs: ${status.logs}`, 'blue');
  log('');
}

async function registerMerchantCommand(args: Record<string, string>, verbose: boolean) {
  const required = ['address', 'name'];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing required argument: --${key}`);
    }
  }

  const merchantInfo: MerchantInfo = {
    address: args.address,
    name: args.name,
    verified: args.verified === 'true',
    riskScore: parseInt(args['risk-score'] || '50'),
    transactionCount: 0,
  };

  const agent = new zkAgent(args.config, verbose);
  agent.getRiskAnalyzer().registerMerchant(merchantInfo);

  log(`✓ Merchant registered: ${merchantInfo.name} (${merchantInfo.address})`, 'green');
}

async function configCommand(args: Record<string, string>) {
  if (args.show) {
    const agent = new zkAgent(args.config, false);
    const config = agent.getStatus().config;

    log('Current Configuration:', 'cyan');
    log(JSON.stringify(config, null, 2));
  } else if (args.template) {
    const template = {
      chainId: 84532,
      rpcUrl: 'https://sepolia.base.org',
      bundlerUrl: 'https://api.pimlico.io/v2/base-sepolia/rpc',
      paymasterAddress: '0xYourPaymasterAddress',
      easAddress: '0xYourEASAddress',
      entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      modelId: 'gpt-4o-mini',
      maxGasPrice: '100000000000',
      maxTransactionValue: '1000000000000000000',
      defaultEpoch: 202511,
      allowedTokens: ['0xUSDC', '0xUSDT', '0xDAI'],
      allowedMerchants: [],
      schemaUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };

    fs.writeFileSync(args.template, JSON.stringify(template, null, 2));
    log(`✓ Config template created: ${args.template}`, 'green');
  } else {
    log('Usage: zkagent config --show or --template <path>', 'yellow');
  }
}

function printHelp() {
  log('═══════════════════════════════════════', 'cyan');
  log('         zkAgent Rails CLI', 'bright');
  log('═══════════════════════════════════════', 'cyan');
  log('');

  log('USAGE:', 'blue');
  log('  zkagent <command> [options]');
  log('');

  log('COMMANDS:', 'blue');
  log('  process              Process a payment request');
  log('  check                Quick approval check');
  log('  status               Show agent status');
  log('  register-merchant    Register a merchant');
  log('  config               Manage configuration');
  log('  help                 Show this help message');
  log('');

  log('PROCESS OPTIONS:', 'blue');
  log('  --merchant <addr>    Merchant address (required)');
  log('  --token <addr>       Token address (required)');
  log('  --amount <value>     Amount in wei (required)');
  log('  --description <text> Payment description');
  log('  --model <id>         AI model ID');
  log('  --prompt <text>      Custom prompt');
  log('  --plan <text>        Plan description');
  log('  --epoch <number>     Epoch number');
  log('  --config <path>      Config file path');
  log('  --output <path>      Export analysis to file');
  log('  --verbose, -v        Verbose output');
  log('');

  log('EXAMPLES:', 'blue');
  log('  # Process a payment');
  log('  zkagent process \\');
  log('    --merchant 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \\');
  log('    --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \\');
  log('    --amount 1000000 \\');
  log('    --description "Buy coffee" \\');
  log('    --output analysis.json');
  log('');

  log('  # Quick check');
  log('  zkagent check \\');
  log('    --merchant 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \\');
  log('    --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \\');
  log('    --amount 1000000');
  log('');

  log('  # Register merchant');
  log('  zkagent register-merchant \\');
  log('    --address 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \\');
  log('    --name "Coffee Shop BA" \\');
  log('    --verified true');
  log('');

  log('  # Show status');
  log('  zkagent status');
  log('');

  log('  # Generate config template');
  log('  zkagent config --template agent-config.json');
  log('');

  log('═══════════════════════════════════════', 'cyan');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
