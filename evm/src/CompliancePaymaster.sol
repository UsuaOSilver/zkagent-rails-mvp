// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPaymaster} from "./interfaces/IPaymaster.sol";
import {IEntryPoint} from "./interfaces/IEntryPoint.sol";
import {IEAS, Attestation} from "./interfaces/IEAS.sol";
import {UserOperation} from "./helpers/Types.sol";

/// @title CompliancePaymaster (MVP)
/// @notice Accepts sponsored ops only if a valid agent-run attestation exists and policy bits match.
contract CompliancePaymaster is IPaymaster {
    IEntryPoint public immutable ENTRY_POINT;
    IEAS       public immutable EAS;
    bytes32    public immutable SCHEMA_UID;

    mapping(address => bool) public attesterWhitelist;

    event AttesterSet(address attester, bool ok);
    event PolicyChecked(bytes32 attUid, bytes32 policyHash, uint256 epoch);

    error NotEntryPoint();
    error InvalidAttestation();
    error AttesterNotWhitelisted();
    error ExpiredAttestation();

    modifier onlyEntryPoint() {
        _onlyEntryPoint();
        _;
    }
    function _onlyEntryPoint() internal view {
        if (msg.sender != address(ENTRY_POINT)) revert NotEntryPoint();
    }

    constructor(address _entryPoint, address _eas, bytes32 schemaUid, address _attester) {
        ENTRY_POINT = IEntryPoint(_entryPoint);
        EAS = IEAS(_eas);
        SCHEMA_UID = schemaUid;
        attesterWhitelist[_attester] = true;
        emit AttesterSet(_attester, true);
    }

    struct PaymasterData {
        bytes32 attUid;     // EAS attestation UID
        bytes32 policyHash; // keccak256(userOpHash, epoch) in MVP
        uint256 epoch;      // epoch for rate-limiting
    }

    function _decode(bytes calldata d) internal pure returns (PaymasterData memory pmd) {
        require(d.length >= 20 + 32*3, "PMD_TOO_SHORT"); // 20 for address + 3 words
        bytes calldata inner = d[20:];                   // strip address prefix
        pmd = abi.decode(inner, (PaymasterData));
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 /*requiredPreFund*/
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        PaymasterData memory pmd = _decode(userOp.paymasterAndData);

        // 1) Check EAS attestation
        if (!EAS.isAttestationValid(pmd.attUid)) revert InvalidAttestation();
        Attestation memory a = EAS.getAttestation(pmd.attUid);
        if (a.schema != SCHEMA_UID) revert InvalidAttestation();
        if (!attesterWhitelist[a.attester]) revert AttesterNotWhitelisted();
        if (a.expirationTime != 0 && a.expirationTime < block.timestamp) revert ExpiredAttestation();

        // 2) Policy binding (MVP: bind to userOpHash + epoch)
        bytes32 expected = _policyHash(userOpHash, pmd.epoch);
        require(expected == pmd.policyHash, "POLICY_MISMATCH");

        emit PolicyChecked(pmd.attUid, pmd.policyHash, pmd.epoch);

        // accept: validationData=0
        return ("", 0);
    }

    function _policyHash(bytes32 userOpHash, uint256 epoch) internal pure returns (bytes32 h) {
        assembly {
            let p := mload(0x40)          // free memory pointer
            mstore(p, userOpHash)         // 32 bytes
            mstore(add(p, 0x20), epoch)   // 32 bytes
            h := keccak256(p, 0x40)       // hash 64 bytes
            mstore(0x40, add(p, 0x40))    // bump free memory pointer
        }
    }

    function postOp(PostOpMode, bytes calldata, uint256) external onlyEntryPoint {
        // MVP: no accounting
    }

    function setAttester(address who, bool ok) external {
        // MVP: public; in production guard with Ownable/roles/timelock
        attesterWhitelist[who] = ok;
        emit AttesterSet(who, ok);
    }
}
