// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

interface IUniswapRouterTest {
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
}
