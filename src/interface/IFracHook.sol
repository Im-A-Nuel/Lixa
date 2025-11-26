// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFracHook {
    function onFTTransfer(uint256 poolId, address from, address to, uint256 amount) external;
}
