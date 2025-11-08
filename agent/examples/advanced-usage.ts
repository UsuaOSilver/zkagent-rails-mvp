/**
 * @file advanced-usage.ts
 * @description Advanced usage patterns for zkAgent Rails
 */

import { zkAgent, PaymentRequest, MerchantInfo } from '../src/index.js';

async function main() {
  // Initialize with custom config
  const agent = new zkAgent('./config/agent-config.json', true);

  // Register trusted merchants
  const merchants: MerchantInfo[] = [
    {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      name: 'Coffee Shop BA',
      verified: true,
      riskScore: 10,
      transactionCount: 150,
    },
    {
      address: '0x1234567890123456789012345678901234567890',
      name: 'Tech Store',
      verified: true,
      riskScore: 15,
      transactionCount: 89,
    },
  ];

  merchants.forEach(merchant => {
    agent.getRiskAnalyzer().registerMerchant(merchant);
  });

  // Batch processing
  const requests: PaymentRequest[] = [
    {
      merchant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      amountIn: 500000n,
      description: 'Coffee',
    },
    {
      merchant: '0x1234567890123456789012345678901234567890',
      tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      amountIn: 50000000n,
      description: 'Laptop',
    },
    {
      merchant: '0x9999999999999999999999999999999999999999',
      tokenIn: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      amountIn: 10000000n,
      description: 'Unknown merchant',
    },
  ];

  console.log('Processing batch of payments...\n');

  const results = await Promise.all(
    requests.map(async (request, index) => {
      try {
        const analysis = await agent.processPayment(request);
        return { index, request, analysis, error: null };
      } catch (error) {
        return { index, request, analysis: null, error };
      }
    })
  );

  // Summarize results
  const approved = results.filter(r => r.analysis?.decision.approved);
  const rejected = results.filter(r => r.analysis && !r.analysis.decision.approved);
  const failed = results.filter(r => r.error);

  console.log('\n═══════════════════════════════════════');
  console.log('           Batch Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Total Requests: ${requests.length}`);
  console.log(`Approved: ${approved.length}`);
  console.log(`Rejected: ${rejected.length}`);
  console.log(`Failed: ${failed.length}`);

  // Show details
  console.log('\nApproved Transactions:');
  approved.forEach(({ index, request, analysis }) => {
    console.log(`  [${index}] ${request.description} - Risk: ${analysis!.decision.riskScore}`);
  });

  console.log('\nRejected Transactions:');
  rejected.forEach(({ index, request, analysis }) => {
    console.log(`  [${index}] ${request.description} - ${analysis!.decision.reason}`);
  });

  if (failed.length > 0) {
    console.log('\nFailed Transactions:');
    failed.forEach(({ index, request, error }) => {
      console.log(`  [${index}] ${request.description} - ${(error as Error).message}`);
    });
  }

  // Get agent status
  const status = agent.getStatus();
  console.log('\nAgent Status:');
  console.log(`  Epoch Spending: ${Object.values(status.epochSpending)[0]}`);
  console.log(`  Log Entries: ${status.logs}`);
}

main().catch(console.error);
