// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "./utils/MerkleProof.sol";

contract KYCRegistry {
    address public owner;
    bytes32 public merkleRoot;
    event RootUpdated(bytes32 newRoot);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner, "NOT_OWNER");
    }

    constructor(bytes32 _root) {
        owner = msg.sender;
        merkleRoot = _root;
        emit RootUpdated(_root);
    }

    function updateRoot(bytes32 _root) external onlyOwner {
        merkleRoot = _root;
        emit RootUpdated(_root);
    }

    function isMember(bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }
}
