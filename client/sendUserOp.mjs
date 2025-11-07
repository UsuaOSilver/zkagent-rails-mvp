import 'dotenv/config';
import { createPublicClient, http, encodeFunctionData, parseAbi, Hex, zeroAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  createBundlerClient,
  ENTRYPOINT_ADDRESS_V06,
  privateKeyToSimpleSmartAccount,
  createSmartAccountClient,
} from 'permissionless';

// ---- env
const {
  PUBLIC_RPC,
  BUNDLER_RPC,
  PIMLICO_API_KEY,
  ENTRYPOINT,
  PAYMASTER,
  TARGET,
  PRIVATE_KEY,     // add a test private key (0x...) with some test ETH on the chosen chain
  PAD_PATH,        // optional: if you wrote paymasterAndData to a file
  PAYMASTER_AND_DATA // optional: pass inline 0x... (overrides PAD_PATH)
} = process.env;

if (!PUBLIC_RPC || !BUNDLER_RPC || !PRIVATE_KEY || !PAYMASTER || !TARGET) {
  console.error("Missing env. Set PUBLIC_RPC, BUNDLER_RPC, PRIVATE_KEY, PAYMASTER, TARGET (and optionally PAYMASTER_AND_DATA or PAD_PATH).");
  process.exit(1);
}

// ---- chain + clients
const chain = baseSepolia; // change if you use a different testnet
const entryPoint = ENTRYPOINT ?? ENTRYPOINT_ADDRESS_V06;

const publicClient = createPublicClient({ chain, transport: http(PUBLIC_RPC) });
const bundlerClient = createBundlerClient({ transport: http(BUNDLER_RPC), chain, entryPoint });

// ---- create a SimpleAccount from your PRIVATE_KEY
const owner = PRIVATE_KEY;
const simpleAccount = await privateKeyToSimpleSmartAccount(publicClient, {
  privateKey: owner,
  entryPoint,
});
const smartAccountClient = await createSmartAccountClient({
  account: simpleAccount,
  chain,
  bundlerTransport: http(BUNDLER_RPC),
  // no paymasterTransport here because we’re using our **own** paymaster via paymasterAndData
});

// ---- assemble paymasterAndData (prefer inline, else read file)
let paymasterAndData = PAYMASTER_AND_DATA;
if (!paymasterAndData && PAD_PATH) {
  const fs = await import('node:fs/promises');
  paymasterAndData = (await fs.readFile(PAD_PATH, 'utf8')).trim();
}
if (!paymasterAndData) {
  console.error("Provide PAYMASTER_AND_DATA=0x... or PAD_PATH=/tmp/pad.txt");
  process.exit(1);
}

// ---- build callData (demo: a NOOP call or a simple function on TARGET)
const abi = parseAbi([ "function emitReceipt(address,address,address,address,uint256,uint256,bytes32,uint256,bytes32)" ]);
const callData = encodeFunctionData({
  abi,
  functionName: "emitReceipt",
  args: [simpleAccount.address, zeroAddress, zeroAddress, zeroAddress, 0n, 0n, "0x"+ "00".repeat(32), 202511n, "0x"+ "00".repeat(32)]
});

// ---- send a userOp from the smart account
const userOpHash = await smartAccountClient.sendUserOperation({
  target: TARGET,
  data: callData,
  value: 0n,
  paymasterAndData,           // <<<<<<<<<<<<<< THIS is where your PAD goes
});

console.log("sent userOp:", userOpHash);

// Optional: wait for included tx
const txHash = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash }).then(r => r?.receipt?.transactionHash);
console.log("mined tx:", txHash);
