// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SecondaryMarket
 * @notice Simple order book for trading FractionalTokens (secondary market)
 * @dev Allows users to list and buy fractional ownership tokens
 *
 * Features:
 * - Create sell orders (escrow tokens)
 * - Buy from sell orders
 * - Cancel orders (refund tokens)
 * - Order matching by price
 */
contract SecondaryMarket is Ownable, ReentrancyGuard {

    struct Order {
        uint256 orderId;
        uint256 poolId;         // Reference to Fractionalizer pool
        address ftAddress;      // FractionalToken contract address
        address seller;
        uint256 amount;         // Amount of FT tokens for sale
        uint256 pricePerToken;  // Price per token in wei
        bool active;
        uint256 createdAt;
    }

    // orderId => Order
    mapping(uint256 => Order) public orders;

    // poolId => orderId[] (all orders for a pool)
    mapping(uint256 => uint256[]) public poolOrders;

    // seller => orderId[] (all orders by a seller)
    mapping(address => uint256[]) public sellerOrders;

    uint256 private _orderCounter;
    uint256 public platformFeeBPS = 250; // 2.5% platform fee (out of 10,000)
    address public feeRecipient;

    event OrderCreated(
        uint256 indexed orderId,
        uint256 indexed poolId,
        address indexed seller,
        address ftAddress,
        uint256 amount,
        uint256 pricePerToken
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 amount,
        uint256 totalPrice
    );

    event OrderCancelled(uint256 indexed orderId, address indexed seller);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor() Ownable(msg.sender) {
        feeRecipient = msg.sender;
    }

    /**
     * @notice Create a sell order for fractional tokens
     * @param poolId Pool ID from Fractionalizer
     * @param ftAddress Address of the FractionalToken contract
     * @param amount Amount of tokens to sell
     * @param pricePerToken Price per token in wei
     */
    function createSellOrder(
        uint256 poolId,
        address ftAddress,
        uint256 amount,
        uint256 pricePerToken
    ) external nonReentrant returns (uint256) {
        require(ftAddress != address(0), "invalid ft address");
        require(amount > 0, "amount must be > 0");
        require(pricePerToken > 0, "price must be > 0");

        IERC20 ft = IERC20(ftAddress);

        // Transfer tokens to this contract (escrow)
        require(ft.balanceOf(msg.sender) >= amount, "insufficient balance");
        require(ft.allowance(msg.sender, address(this)) >= amount, "insufficient allowance");

        bool success = ft.transferFrom(msg.sender, address(this), amount);
        require(success, "transfer failed");

        _orderCounter++;
        uint256 orderId = _orderCounter;

        orders[orderId] = Order({
            orderId: orderId,
            poolId: poolId,
            ftAddress: ftAddress,
            seller: msg.sender,
            amount: amount,
            pricePerToken: pricePerToken,
            active: true,
            createdAt: block.timestamp
        });

        poolOrders[poolId].push(orderId);
        sellerOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, poolId, msg.sender, ftAddress, amount, pricePerToken);
        return orderId;
    }

    /**
     * @notice Buy tokens from a sell order
     * @param orderId ID of the order to buy from
     * @param amount Amount of tokens to buy (can be partial)
     */
    function buyFromOrder(uint256 orderId, uint256 amount) external payable nonReentrant {
        Order storage order = orders[orderId];
        require(order.active, "order not active");
        require(amount > 0 && amount <= order.amount, "invalid amount");
        require(msg.sender != order.seller, "cannot buy own order");

        uint256 totalPrice = amount * order.pricePerToken;
        require(msg.value >= totalPrice, "insufficient payment");

        // Calculate platform fee
        uint256 platformFee = (totalPrice * platformFeeBPS) / 10000;
        uint256 sellerProceeds = totalPrice - platformFee;

        // Update order
        order.amount -= amount;
        if (order.amount == 0) {
            order.active = false;
        }

        // Transfer tokens to buyer
        IERC20 ft = IERC20(order.ftAddress);
        bool success = ft.transfer(msg.sender, amount);
        require(success, "token transfer failed");

        // Transfer proceeds to seller
        (bool sentSeller, ) = payable(order.seller).call{value: sellerProceeds}("");
        require(sentSeller, "seller payment failed");

        // Transfer fee to platform
        if (platformFee > 0) {
            (bool sentFee, ) = payable(feeRecipient).call{value: platformFee}("");
            require(sentFee, "fee payment failed");
        }

        // Refund excess payment
        if (msg.value > totalPrice) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - totalPrice}("");
            require(refunded, "refund failed");
        }

        emit OrderFilled(orderId, msg.sender, amount, totalPrice);
    }

    /**
     * @notice Cancel a sell order and return tokens to seller
     * @param orderId ID of the order to cancel
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.active, "order not active");
        require(msg.sender == order.seller, "not order owner");

        uint256 refundAmount = order.amount;
        order.amount = 0;
        order.active = false;

        // Return tokens to seller
        IERC20 ft = IERC20(order.ftAddress);
        bool success = ft.transfer(order.seller, refundAmount);
        require(success, "refund transfer failed");

        emit OrderCancelled(orderId, msg.sender);
    }

    /**
     * @notice Get all active orders for a pool
     * @param poolId Pool ID to query
     * @return Array of order IDs
     */
    function getPoolOrders(uint256 poolId) external view returns (uint256[] memory) {
        uint256[] memory allOrders = poolOrders[poolId];

        // Count active orders
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allOrders.length; i++) {
            if (orders[allOrders[i]].active) {
                activeCount++;
            }
        }

        // Build active orders array
        uint256[] memory activeOrders = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allOrders.length; i++) {
            if (orders[allOrders[i]].active) {
                activeOrders[index] = allOrders[i];
                index++;
            }
        }

        return activeOrders;
    }

    /**
     * @notice Get all orders by a seller
     * @param seller Seller address to query
     * @return Array of order IDs
     */
    function getSellerOrders(address seller) external view returns (uint256[] memory) {
        return sellerOrders[seller];
    }

    /**
     * @notice Get detailed order information
     * @param orderId Order ID to query
     */
    function getOrderDetails(uint256 orderId) external view returns (
        uint256 poolId,
        address ftAddress,
        address seller,
        uint256 amount,
        uint256 pricePerToken,
        bool active,
        uint256 createdAt
    ) {
        Order storage order = orders[orderId];
        return (
            order.poolId,
            order.ftAddress,
            order.seller,
            order.amount,
            order.pricePerToken,
            order.active,
            order.createdAt
        );
    }

    /**
     * @notice Update platform fee (only owner)
     * @param newFeeBPS New fee in basis points (max 1000 = 10%)
     */
    function setPlatformFee(uint256 newFeeBPS) external onlyOwner {
        require(newFeeBPS <= 1000, "fee too high (max 10%)");
        uint256 oldFee = platformFeeBPS;
        platformFeeBPS = newFeeBPS;
        emit PlatformFeeUpdated(oldFee, newFeeBPS);
    }

    /**
     * @notice Update fee recipient address (only owner)
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "invalid recipient");
        feeRecipient = newRecipient;
    }

    /**
     * @notice Get total number of orders created
     */
    function totalOrders() external view returns (uint256) {
        return _orderCounter;
    }
}
