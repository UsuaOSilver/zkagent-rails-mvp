/**
 * @file basic-usage.ts
 * @description Basic usage example for zkAgent Rails
 */

import { zkAgent, PaymentRequest } from '../src/index.js';

async function main() {
  // Initialize agent
  const agent = new zkAgent(undefined, true); // verbose mode

  // Create a payment request
  const request: PaymentRequest = {
    merchant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    amountIn: 1000000n, // 1 USDC (6 decimals)
    description: 'Buy coffee at Coffee Shop BA',
    metadata: {
      location: 'Buenos Aires',
      items: ['Espresso', 'Croissant'],
    },
  };

  // Process the payment
  const analysis = await agent.processPayment(request, {
    modelId: 'gpt-4o-mini',
    prompt: 'Analyze this coffee purchase',
    planDescription: 'Regular morning coffee',
  });

  // Check the result
  if (analysis.decision.approved) {
    console.log('✓ Payment APPROVED');
    console.log(`Risk Score: ${analysis.decision.riskScore}/100`);

    // Get paymasterAndData for UserOp
    const paymasterData = agent.buildPaymasterData(analysis);
    console.log(`\nPaymaster Data: ${paymasterData}`);

    // Export for record keeping
    agent.exportAnalysis(analysis, 'payment-analysis.json');
  } else {
    console.log('✗ Payment REJECTED');
    console.log(`Reason: ${analysis.decision.reason}`);

    if (analysis.policyValidation.violations.length > 0) {
      console.log('\nPolicy Violations:');
      analysis.policyValidation.violations.forEach(v => console.log(`  - ${v}`));
    }
  }
}

main().catch(console.error);
