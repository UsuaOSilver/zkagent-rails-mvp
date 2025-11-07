// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MerchantReceipts {
    event Receipt(
        address indexed payer,
        address indexed merchant,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes32  nullifierHash,
        uint256  epoch,
        bytes32  policyHash
    );

    function emitReceipt(
        address payer,
        address merchant,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 nullifierHash,
        uint256 epoch,
        bytes32 policyHash
    ) external {
        emit Receipt(payer, merchant, tokenIn, tokenOut, amountIn, amountOut, nullifierHash, epoch, policyHash);
    }
}
