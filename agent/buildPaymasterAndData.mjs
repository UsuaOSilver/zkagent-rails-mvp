import { encodeAbiParameters, concatHex } from "viem";
import fs from "fs";

function arg(k, def="") {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i+1] : def;
}

const paymaster = arg("--paymaster");               // 0xPaymasterAddress (20 bytes)
const attUid    = arg("--attUid", "0x" + "00".repeat(32)); // placeholder OK
const epochStr  = arg("--epoch");                   // e.g. 202511
let policyHash  = arg("--policyHash");
const jsonPath  = arg("--json");                    // or pass a file from runner output

if (!paymaster) {
  console.error("Missing --paymaster 0x...");
  process.exit(1);
}
if (jsonPath && !policyHash) {
  const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  policyHash = j.policyHash;
}
if (!policyHash || !epochStr) {
  console.error("Need --policyHash 0x.. and --epoch 202511 (or provide --json path with policyHash/epoch)");
  process.exit(1);
}

const inner = encodeAbiParameters(
  [
    { type: "bytes32", name: "attUid" },
    { type: "bytes32", name: "policyHash" },
    { type: "uint256", name: "epoch" },
  ],
  [attUid, policyHash, BigInt(epochStr)]
);

// paymasterAndData = 20-byte paymaster address || abi.encode(...)
const paymasterAndData = concatHex([paymaster, inner]);

console.log(paymasterAndData);
