// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/contract/MarketAsset.sol";
import "../src/contract/SecondaryMarket.sol";

/**
 * @title SecondaryMarket Test
 * @notice Test suite for SecondaryMarket contract
 */
contract SecondaryMarketTest is Test {
    AssetNFT assetNft;
    AssetRegistry registry;
    Fractionalizer fractionalizer;
    SecondaryMarket market;

    address creator = address(0x1);
    address seller = address(0x2);
    address buyer = address(0x3);
    address platformOwner = address(0x99);

    uint256 constant INITIAL_SUPPLY = 1000 ether;
    uint256 constant PRIMARY_PRICE = 0.001 ether;

    uint256 poolId;
    address ftAddress;

    function setUp() public {
        // Deploy core contracts
        assetNft = new AssetNFT("Lixa Asset", "LIXA");
        registry = new AssetRegistry(address(assetNft));
        fractionalizer = new Fractionalizer(address(registry));

        // Deploy secondary market
        vm.prank(platformOwner);
        market = new SecondaryMarket();

        // Setup permissions
        assetNft.setRegistry(address(registry));

        // Fund test accounts
        vm.deal(creator, 100 ether);
        vm.deal(seller, 100 ether);
        vm.deal(buyer, 100 ether);

        // Setup: Create fractional pool
        vm.startPrank(creator);
        uint256 assetId = registry.registerAsset("ipfs://test", 1000);
        AssetRegistry.Asset memory asset = registry.getAsset(assetId);
        assetNft.approve(address(fractionalizer), asset.tokenId);

        poolId = fractionalizer.fractionalize(
            assetId,
            address(assetNft),
            asset.tokenId,
            "Fractional Asset",
            "FRAC",
            INITIAL_SUPPLY,
            PRIMARY_PRICE,
            INITIAL_SUPPLY / 2,
            creator
        );

        (,,ftAddress,,,,,,, ) = fractionalizer.poolInfo(poolId);
        FractionalToken ft = FractionalToken(ftAddress);
        ft.approve(address(fractionalizer), INITIAL_SUPPLY);
        vm.stopPrank();

        // Seller buys tokens from primary market
        uint256 buyValue = (200 ether * PRIMARY_PRICE) / 1 ether; // Calculate correctly
        vm.prank(seller);
        fractionalizer.buyFractions{value: buyValue}(poolId, 200 ether);
    }

    function testCreateSellOrder() public {
        FractionalToken ft = FractionalToken(ftAddress);

        vm.startPrank(seller);
        ft.approve(address(market), 100 ether);

        uint256 orderId = market.createSellOrder(
            poolId,
            ftAddress,
            100 ether,
            0.002 ether // 2x primary price
        );
        vm.stopPrank();

        // Verify order created
        assertEq(orderId, 1, "First order should be ID 1");

        (uint256 pid, address ft_addr, address seller_addr, uint256 amount, uint256 price, bool active, )
            = market.getOrderDetails(orderId);

        assertEq(pid, poolId, "Pool ID mismatch");
        assertEq(ft_addr, ftAddress, "FT address mismatch");
        assertEq(seller_addr, seller, "Seller mismatch");
        assertEq(amount, 100 ether, "Amount mismatch");
        assertEq(price, 0.002 ether, "Price mismatch");
        assertTrue(active, "Order should be active");

        // Verify tokens are escrowed
        assertEq(ft.balanceOf(address(market)), 100 ether, "Tokens should be in escrow");
        assertEq(ft.balanceOf(seller), 100 ether, "Seller should have 100 tokens left");
    }

    function testBuyFromOrder() public {
        FractionalToken ft = FractionalToken(ftAddress);

        // Seller creates order
        vm.startPrank(seller);
        ft.approve(address(market), 100 ether);
        uint256 orderId = market.createSellOrder(poolId, ftAddress, 100 ether, 0.002 ether);
        vm.stopPrank();

        // Buyer purchases full order
        uint256 totalCost = 100 ether * 0.002 ether; // 0.2 ETH
        uint256 platformFee = (totalCost * 250) / 10000; // 2.5%
        uint256 sellerProceeds = totalCost - platformFee;

        uint256 sellerBalanceBefore = seller.balance;
        uint256 buyerFTBalanceBefore = ft.balanceOf(buyer);

        vm.prank(buyer);
        market.buyFromOrder{value: totalCost}(orderId, 100 ether);

        // Verify balances
        assertEq(ft.balanceOf(buyer), buyerFTBalanceBefore + 100 ether, "Buyer should receive tokens");
        assertEq(seller.balance, sellerBalanceBefore + sellerProceeds, "Seller should receive payment");
        assertEq(platformOwner.balance, platformFee, "Platform should receive fee");

        // Verify order is closed
        (,,,, , bool active, ) = market.getOrderDetails(orderId);
        assertFalse(active, "Order should be inactive");
    }

    function testPartialBuyFromOrder() public {
        FractionalToken ft = FractionalToken(ftAddress);

        // Seller creates order
        vm.startPrank(seller);
        ft.approve(address(market), 100 ether);
        uint256 orderId = market.createSellOrder(poolId, ftAddress, 100 ether, 0.002 ether);
        vm.stopPrank();

        // Buyer purchases 30 tokens (partial)
        uint256 buyAmount = 30 ether;
        uint256 totalCost = buyAmount * 0.002 ether;

        vm.prank(buyer);
        market.buyFromOrder{value: totalCost}(orderId, buyAmount);

        // Verify balances
        assertEq(ft.balanceOf(buyer), buyAmount, "Buyer should receive 30 tokens");

        // Verify order is still active with reduced amount
        (,,,uint256 remainingAmount, , bool active, ) = market.getOrderDetails(orderId);
        assertTrue(active, "Order should still be active");
        assertEq(remainingAmount, 70 ether, "Order should have 70 tokens left");
    }

    function testCancelOrder() public {
        FractionalToken ft = FractionalToken(ftAddress);

        // Seller creates order
        vm.startPrank(seller);
        ft.approve(address(market), 100 ether);
        uint256 orderId = market.createSellOrder(poolId, ftAddress, 100 ether, 0.002 ether);

        // Cancel order
        market.cancelOrder(orderId);
        vm.stopPrank();

        // Verify order is cancelled
        (,,,, , bool active, ) = market.getOrderDetails(orderId);
        assertFalse(active, "Order should be inactive");

        // Verify tokens returned to seller
        assertEq(ft.balanceOf(seller), 200 ether, "Seller should have all tokens back");
        assertEq(ft.balanceOf(address(market)), 0, "Market should have no tokens");
    }

    function testCannotBuyOwnOrder() public {
        FractionalToken ft = FractionalToken(ftAddress);

        vm.startPrank(seller);
        ft.approve(address(market), 100 ether);
        uint256 orderId = market.createSellOrder(poolId, ftAddress, 100 ether, 0.002 ether);

        // Try to buy own order
        vm.expectRevert("cannot buy own order");
        market.buyFromOrder{value: 0.2 ether}(orderId, 100 ether);
        vm.stopPrank();
    }

    function testCannotCancelOthersOrder() public {
        FractionalToken ft = FractionalToken(ftAddress);

        vm.startPrank(seller);
        ft.approve(address(market), 100 ether);
        uint256 orderId = market.createSellOrder(poolId, ftAddress, 100 ether, 0.002 ether);
        vm.stopPrank();

        // Buyer tries to cancel seller's order
        vm.prank(buyer);
        vm.expectRevert("not order owner");
        market.cancelOrder(orderId);
    }

    function testGetPoolOrders() public {
        FractionalToken ft = FractionalToken(ftAddress);

        // Create multiple orders
        vm.startPrank(seller);
        ft.approve(address(market), 200 ether);

        uint256 orderId1 = market.createSellOrder(poolId, ftAddress, 50 ether, 0.002 ether);
        uint256 orderId2 = market.createSellOrder(poolId, ftAddress, 50 ether, 0.003 ether);
        vm.stopPrank();

        // Get pool orders
        uint256[] memory poolOrderIds = market.getPoolOrders(poolId);
        assertEq(poolOrderIds.length, 2, "Should have 2 active orders");
        assertEq(poolOrderIds[0], orderId1, "First order ID mismatch");
        assertEq(poolOrderIds[1], orderId2, "Second order ID mismatch");

        // Cancel one order
        vm.prank(seller);
        market.cancelOrder(orderId1);

        // Should now only return 1 active order
        poolOrderIds = market.getPoolOrders(poolId);
        assertEq(poolOrderIds.length, 1, "Should have 1 active order");
        assertEq(poolOrderIds[0], orderId2, "Should only show second order");
    }

    function testMultipleBuyersScenario() public {
        FractionalToken ft = FractionalToken(ftAddress);
        address buyer2 = address(0x4);
        vm.deal(buyer2, 100 ether);

        // Seller creates order
        vm.startPrank(seller);
        ft.approve(address(market), 100 ether);
        uint256 orderId = market.createSellOrder(poolId, ftAddress, 100 ether, 0.002 ether);
        vm.stopPrank();

        // Buyer 1 buys 40 tokens
        vm.prank(buyer);
        market.buyFromOrder{value: 40 ether * 0.002 ether}(orderId, 40 ether);

        // Buyer 2 buys 60 tokens
        vm.prank(buyer2);
        market.buyFromOrder{value: 60 ether * 0.002 ether}(orderId, 60 ether);

        // Verify distributions
        assertEq(ft.balanceOf(buyer), 40 ether, "Buyer1 should have 40 tokens");
        assertEq(ft.balanceOf(buyer2), 60 ether, "Buyer2 should have 60 tokens");

        // Order should be closed
        (,,,, , bool active, ) = market.getOrderDetails(orderId);
        assertFalse(active, "Order should be fully filled");
    }

    function testPlatformFeeUpdate() public {
        vm.prank(platformOwner);
        market.setPlatformFee(500); // 5%

        assertEq(market.platformFeeBPS(), 500, "Fee should be updated to 5%");

        // Test fee cannot exceed 10%
        vm.prank(platformOwner);
        vm.expectRevert("fee too high (max 10%)");
        market.setPlatformFee(1001);
    }
}
