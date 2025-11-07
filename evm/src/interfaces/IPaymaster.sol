// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {UserOperation} from "../helpers/Types.sol";

interface IPaymaster {
    enum PostOpMode { opSucceeded, opReverted, postOpReverted }
    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 requiredPreFund)
        external
        returns (bytes memory context, uint256 validationData);
    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) external;
}
