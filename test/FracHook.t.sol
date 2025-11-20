// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/contract/MarketAsset.sol";

/**
 * @title FracHook Test
 * @notice Test suite for IFracHook dividend distribution mechanism
 * @dev Tests the critical fix: accPerShare updates on token transfer
 */
contract FracHookTest is Test {
    AssetNFT assetNft;
    AssetRegistry registry;
    Fractionalizer fractionalizer;

    address creator = address(0x1);
    address buyer1 = address(0x2);
    address buyer2 = address(0x3);

    uint256 constant INITIAL_SUPPLY = 1000 ether;
    uint256 constant SALE_PRICE = 0.001 ether;

    function setUp() public {
        // Deploy contracts
        assetNft = new AssetNFT("Lixa Asset", "LIXA");
        registry = new AssetRegistry(address(assetNft));
        fractionalizer = new Fractionalizer(address(registry));

        // Setup permissions
        assetNft.setRegistry(address(registry));

        // Fund test accounts
        vm.deal(creator, 100 ether);
        vm.deal(buyer1, 100 ether);
        vm.deal(buyer2, 100 ether);
    }

    function testHookUpdatesWithdrawnOnTransfer() public {
        // 1. Creator registers and fractionalizes asset
        vm.startPrank(creator);
        uint256 assetId = registry.registerAsset("ipfs://test", 1000);

        AssetRegistry.Asset memory asset = registry.getAsset(assetId);
        assetNft.approve(address(fractionalizer), asset.tokenId);

        uint256 poolId = fractionalizer.fractionalize(
            assetId,
            address(assetNft),
            asset.tokenId,
            "Fractional Asset",
            "FRAC",
            INITIAL_SUPPLY,
            SALE_PRICE,
            INITIAL_SUPPLY / 2, // 50% for sale
            creator
        );

        (,,address ftAddress,,,,,,bool active,) = fractionalizer.poolInfo(poolId);
        FractionalToken ft = FractionalToken(ftAddress);

        // Approve fractionalizer to sell tokens
        ft.approve(address(fractionalizer), INITIAL_SUPPLY);
        vm.stopPrank();

        // 2. Buyer1 purchases 100 tokens
        vm.prank(buyer1);
        fractionalizer.buyFractions{value: 100 ether * SALE_PRICE}(poolId, 100 ether);

        // 3. Deposit dividends (simulating license sales)
        uint256 dividendAmount = 10 ether;
        fractionalizer.depositToPool{value: dividendAmount}(poolId);

        // 4. Verify dividendsPerToken is updated
        (,,,,,,,,,uint256 dividendsPerToken) = fractionalizer.poolInfo(poolId);
        assertEq(dividendsPerToken, (dividendAmount * 1e18) / INITIAL_SUPPLY, "dividendsPerToken should be updated");

        // 5. CRITICAL TEST: Buyer1 transfers 50 tokens to Buyer2
        vm.prank(buyer1);
        ft.transfer(buyer2, 50 ether);

        // 6. Verify balances
        assertEq(ft.balanceOf(buyer1), 50 ether, "Buyer1 should have 50 tokens");
        assertEq(ft.balanceOf(buyer2), 50 ether, "Buyer2 should have 50 tokens");

        // 7. Calculate expected claimable amounts
        // Buyer1: owned 100 tokens when dividends deposited, now has 50
        // Should be able to claim: 100 * dividendsPerToken / 1e18
        uint256 buyer1Expected = (100 ether * dividendsPerToken) / 1e18;

        // Buyer2: received 50 tokens AFTER dividends deposited
        // Should NOT be able to claim any past dividends (withdrawn should be adjusted)
        uint256 buyer2Expected = 0;

        uint256 buyer1Claimable = fractionalizer.claimableAmount(poolId, buyer1);
        uint256 buyer2Claimable = fractionalizer.claimableAmount(poolId, buyer2);

        assertEq(buyer1Claimable, buyer1Expected, "Buyer1 should claim dividends for 100 tokens");
        assertEq(buyer2Claimable, buyer2Expected, "Buyer2 should NOT claim past dividends");

        // 8. Deposit more dividends AFTER transfer
        uint256 secondDividend = 5 ether;
        fractionalizer.depositToPool{value: secondDividend}(poolId);

        // 9. Now BOTH should be able to claim proportionally for NEW dividends
        (,,,,,,,,,uint256 newDividendsPerToken) = fractionalizer.poolInfo(poolId);
        uint256 totalNewDividends = ((newDividendsPerToken - dividendsPerToken) * 50 ether) / 1e18;

        buyer1Claimable = fractionalizer.claimableAmount(poolId, buyer1);
        buyer2Claimable = fractionalizer.claimableAmount(poolId, buyer2);

        // Buyer1: old dividends (100 tokens) + new dividends (50 tokens)
        assertEq(buyer1Claimable, buyer1Expected + totalNewDividends, "Buyer1 new claim");
        // Buyer2: only new dividends (50 tokens)
        assertEq(buyer2Claimable, totalNewDividends, "Buyer2 should only claim new dividends");
    }

    function testMultipleTransfersPreserveFairness() public {
        // Setup: Create pool and distribute tokens
        vm.startPrank(creator);
        uint256 assetId = registry.registerAsset("ipfs://test", 1000);
        AssetRegistry.Asset memory asset = registry.getAsset(assetId);
        assetNft.approve(address(fractionalizer), asset.tokenId);

        uint256 poolId = fractionalizer.fractionalize(
            assetId,
            address(assetNft),
            asset.tokenId,
            "Fractional Asset",
            "FRAC",
            1000 ether,
            SALE_PRICE,
            500 ether,
            creator
        );

        (,,address ftAddress,,,,,,bool active,) = fractionalizer.poolInfo(poolId);
        FractionalToken ft = FractionalToken(ftAddress);
        ft.approve(address(fractionalizer), 1000 ether);
        vm.stopPrank();

        // Buyer1 gets 300 tokens
        vm.prank(buyer1);
        fractionalizer.buyFractions{value: 300 ether * SALE_PRICE}(poolId, 300 ether);

        // Dividend round 1
        fractionalizer.depositToPool{value: 10 ether}(poolId);

        // Transfer chain: buyer1 -> buyer2 -> buyer1
        vm.prank(buyer1);
        ft.transfer(buyer2, 100 ether); // buyer1: 200, buyer2: 100

        // Dividend round 2
        fractionalizer.depositToPool{value: 5 ether}(poolId);

        vm.prank(buyer2);
        ft.transfer(buyer1, 50 ether); // buyer1: 250, buyer2: 50

        // Verify no user can claim more than their fair share
        uint256 totalClaimable = fractionalizer.claimableAmount(poolId, buyer1)
                                + fractionalizer.claimableAmount(poolId, buyer2)
                                + fractionalizer.claimableAmount(poolId, creator);

        // Total should equal total dividends deposited (15 ether)
        assertLe(totalClaimable, 15 ether, "Total claims should not exceed deposits");
        assertGe(totalClaimable, 14.9 ether, "Claims should be close to deposits (accounting for rounding)");
    }
}
