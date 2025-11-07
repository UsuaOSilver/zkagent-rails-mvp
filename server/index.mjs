import express from "express";
import cors from "cors";
import { encodeAbiParameters, concatHex } from "viem";

const app = express();
app.use(cors());
app.use(express.json());

// POST /build-paymaster-data
// body: { paymaster, attUid?, policyHash, epoch }
app.post("/build-paymaster-data", async (req, res) => {
  try {
    const { paymaster, policyHash, epoch, attUid } = req.body || {};
    if (!paymaster || !policyHash || !epoch) {
      return res.status(400).json({ error: "paymaster, policyHash, epoch required" });
    }
    const inner = encodeAbiParameters(
      [
        { type: "bytes32", name: "attUid" },
        { type: "bytes32", name: "policyHash" },
        { type: "uint256", name: "epoch" },
      ],
      [attUid ?? ("0x" + "00".repeat(32)), policyHash, BigInt(epoch)]
    );
    const paymasterAndData = concatHex([paymaster, inner]);
    res.json({ paymasterAndData });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`zkAgent server listening on :${PORT}`));
