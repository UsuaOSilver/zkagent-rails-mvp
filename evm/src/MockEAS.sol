// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct Attestation {
    bytes32 uid; bytes32 schema; address attester; uint64 time; uint64 expirationTime; uint64 revocationTime; bytes32 dataHash;
}
interface IEAS { function getAttestation(bytes32 uid) external view returns (Attestation memory); function isAttestationValid(bytes32 uid) external view returns (bool); }

contract MockEAS is IEAS {
    mapping(bytes32 => Attestation) public a;
    function set(bytes32 uid, bytes32 schema, address attester, uint64 exp, bytes32 dataHash) external {
        a[uid] = Attestation(uid, schema, attester, uint64(block.timestamp), exp, 0, dataHash);
    }
    function getAttestation(bytes32 uid) external view returns (Attestation memory) { return a[uid]; }
    function isAttestationValid(bytes32 uid) external view returns (bool) {
        Attestation memory m = a[uid];
        return m.attester != address(0) && (m.expirationTime == 0 || m.expirationTime >= block.timestamp);
    }
}
