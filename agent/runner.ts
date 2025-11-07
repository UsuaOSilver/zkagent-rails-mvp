import { createHash } from "crypto";

// compute sha3-256 (OK for demo). If sha3-256 isn't available in your OpenSSL build,
// you can change 'sha3-256' to 'sha256' to keep going (less ideal, still fine for MVP).
function keccakHex(input: Buffer | string): string {
  try {
    const h = createHash("sha3-256");
    h.update(input);
    return "0x" + h.digest("hex");
  } catch {
    const h = createHash("sha256");
    h.update(input);
    return "0x" + h.digest("hex");
  }
}

function hexToBuf(hex: string): Buffer {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (s.length !== 64) {
    // still accept shorter inputs for demos; left-pad to 32 bytes
    return Buffer.from(s.padStart(64, "0"), "hex");
  }
  return Buffer.from(s, "hex");
}

function u256ToBytes32(n: bigint): Buffer {
  const b = Buffer.alloc(32);
  let x = n;
  for (let i = 31; i >= 0; i--) {
    b[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return b;
}

type Args = {
  model: string;
  prompt: string;
  plan: string;
  userOpHash?: string;   // preferred
  callDataHash?: string; // legacy param; we'll accept but treat it as userOpHash for demo if provided
  epoch: string;         // e.g., "202511"
};

function parseArgs(): Args {
  const args: any = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i]?.replace(/^--/, "");
    const v = process.argv[i + 1];
    args[k] = v;
  }
  if (!args.model || !args.prompt || !args.plan || !(args.userOpHash || args.callDataHash) || !args.epoch) {
    console.error(
      "Usage: node dist/runner.js --model <id> --prompt <text> --plan <text> --userOpHash 0x.. --epoch 202511\n" +
      "(--callDataHash 0x.. is accepted for demo, but real flow should use --userOpHash)"
    );
    process.exit(1);
  }
  return args as Args;
}

const a = parseArgs();
const userOpHex = a.userOpHash ?? a.callDataHash!;

const modelHash  = keccakHex(a.model);
const promptHash = keccakHex(a.prompt);
const planHash   = keccakHex(a.plan);

// On-chain we compare keccak256( userOpHash (32 bytes) || epoch (uint256, 32 bytes) )
const userOpBuf = hexToBuf(userOpHex);
const epochBuf  = u256ToBytes32(BigInt(a.epoch));
const policyHash = keccakHex(Buffer.concat([userOpBuf, epochBuf]));

const out = {
  modelHash,
  promptHash,
  planHash,
  userOpHash: "0x" + userOpBuf.toString("hex"),
  epoch: a.epoch,
  policyHash
};

console.log(JSON.stringify(out, null, 2));
