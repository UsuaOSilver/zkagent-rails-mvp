// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct Attestation {
    bytes32 uid;
    bytes32 schema;
    address attester;
    uint64  time;
    uint64  expirationTime;
    uint64  revocationTime;
    bytes32 dataHash; // MVP: hash over (modelHash, promptHash, planHash, callDataHash, policyBits)
}

interface IEAS {
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
    function isAttestationValid(bytes32 uid) external view returns (bool);
}
