// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {UserOperation} from "../helpers/Types.sol";

interface IEntryPoint {
    function getUserOpHash(UserOperation calldata userOp) external view returns (bytes32);
}
