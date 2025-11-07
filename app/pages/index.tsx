import { useState } from "react";

export default function Home() {
  const [paymaster, setPaymaster]   = useState("0xYourPaymaster");
  const [policyHash, setPolicyHash] = useState("");
  const [epoch, setEpoch]           = useState("202511");
  const [out, setOut]               = useState("");

  const build = async () => {
    const r = await fetch("http://localhost:8787/build-paymaster-data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymaster, policyHash, epoch })
    });
    const j = await r.json();
    setOut(j.paymasterAndData || JSON.stringify(j));
  };

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 800 }}>
      <h1>zkAgent Rails — Build paymasterAndData</h1>
      <label>Paymaster</label>
      <input value={paymaster} onChange={e=>setPaymaster(e.target.value)} style={{width:"100%"}}/>
      <label>policyHash (paste from agent runner output)</label>
      <input value={policyHash} onChange={e=>setPolicyHash(e.target.value)} style={{width:"100%"}}/>
      <label>epoch</label>
      <input value={epoch} onChange={e=>setEpoch(e.target.value)} style={{width:"100%"}}/>
      <button onClick={build} style={{marginTop:12}}>Build</button>
      <pre style={{whiteSpace:"pre-wrap", marginTop:16}}>{out}</pre>
      <p>Paste this value into <code>userOp.paymasterAndData</code> before sending.</p>
    </main>
  );
}
