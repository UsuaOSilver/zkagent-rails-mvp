// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DollarRouter.sol";

/**
 * @title DollarRouter Tests
 * @notice Test suite for DollarRouter stablecoin swapping contract
 */
contract DollarRouterTest is Test {
    DollarRouter public router;

    address public owner = address(0x1);
    address public usdc = address(0x2);
    address public usdt = address(0x3);
    address public dai = address(0x4);
    address public swapRouter = address(0x5);

    function setUp() public {
        vm.prank(owner);
        router = new DollarRouter(usdc, swapRouter);
    }

    function test_Deployment() public {
        assertGt(address(router).code.length, 0);
        // Verify router was deployed successfully
    }

    // Note: Add zero address validation tests if constructor adds require() checks

    function testFuzz_DeploymentWithDifferentAddresses(address _usdc, address _swapRouter) public {
        vm.assume(_usdc != address(0));
        vm.assume(_swapRouter != address(0));
        vm.prank(owner);
        DollarRouter testRouter = new DollarRouter(_usdc, _swapRouter);
        assertGt(address(testRouter).code.length, 0);
    }
}
