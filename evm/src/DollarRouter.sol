// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

contract DollarRouter {
    address public immutable USDC;
    ISwapRouter public immutable ROUTER;
    address public owner;
    mapping(address => bool) public allowedToken;

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }
    function _onlyOwner() internal view {
        require(msg.sender == owner, "NOT_OWNER");
    }

    constructor(address _usdc, address _router) {
        USDC = _usdc;
        ROUTER = ISwapRouter(_router);
        owner = msg.sender;
        allowedToken[_usdc] = true;
    }

    function setAllowed(address token, bool ok) external onlyOwner {
        allowedToken[token] = ok;
    }

    function payWithAnyStable(
        address tokenIn,
        uint256 amountIn,
        uint24 poolFee,
        address merchant,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        require(allowedToken[tokenIn], "TOKEN_NOT_ALLOWED");

        // Check returns to avoid erc20-unchecked-transfer warning
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TRANSFER_FROM_FAILED");

        if (tokenIn == USDC) {
            amountOut = amountIn;
        } else {
            // Approve and swap
            require(IERC20(tokenIn).approve(address(ROUTER), amountIn), "APPROVE_FAILED");
            amountOut = ROUTER.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: USDC,
                    fee: poolFee,
                    recipient: address(this),
                    deadline: block.timestamp + 600,
                    amountIn: amountIn,
                    amountOutMinimum: minOut,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        require(amountOut >= minOut, "SLIPPAGE");
        require(IERC20(USDC).transfer(merchant, amountOut), "TRANSFER_FAILED");
    }
}
