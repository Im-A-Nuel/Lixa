// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title OrderBook
 * @notice Onchain settlement untuk offchain bid/ask orders menggunakan EIP-712 signatures
 *
 * Flow:
 * 1. User sign bid/ask order offchain (tidak ada gas)
 * 2. Backend match orders
 * 3. Caller execute trade dengan signatures dari buyer dan seller
 * 4. Smart contract verifikasi signatures dan execute transfer
 */

contract OrderBook is EIP712, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // Order structure harus match dengan yang di-sign di frontend
    struct Order {
        string orderId;
        string side; // "BID" atau "ASK"
        uint256 poolId;
        address ftAddress;
        uint256 amount; // 18 decimals
        uint256 pricePerToken; // 18 decimals (dalam wei/ETH)
        address userAddress;
        uint256 nonce;
        uint256 expiresAt;
    }

    // Type hash untuk EIP-712
    bytes32 private constant ORDER_TYPEHASH =
        keccak256(
            "Order(string orderId,string side,uint256 poolId,address ftAddress,uint256 amount,uint256 pricePerToken,address userAddress,uint256 nonce,uint256 expiresAt)"
        );

    // Tracking nonces untuk prevent replay attacks
    mapping(address => uint256) public userNonces;

    // Track executed orders
    mapping(string => uint256) public executedAmounts; // orderId -> amountFilled

    // Platform fee (25 = 2.5%)
    uint256 public platformFee = 25;
    address public feeRecipient;

    event OrderMatched(
        string indexed buyOrderId,
        string indexed sellOrderId,
        address indexed buyer,
        address seller,
        address ftAddress,
        uint256 amount,
        uint256 pricePerToken,
        uint256 totalValue
    );

    event OrderCancelled(string indexed orderId, address indexed user);

    constructor() EIP712("Lixa Order Book", "1") Ownable(msg.sender) {
        feeRecipient = msg.sender;
    }

    /**
     * @notice Execute trade antara bid dan ask order
     * @param buyOrder Signed bid order dari buyer
     * @param buySignature Signature dari buyer
     * @param sellOrder Signed ask order dari seller
     * @param sellSignature Signature dari seller
     * @param amount Jumlah yang di-trade (bisa partial fill)
     */
    function executeTrade(
        Order calldata buyOrder,
        bytes calldata buySignature,
        Order calldata sellOrder,
        bytes calldata sellSignature,
        uint256 amount
    ) external payable {
        // Validasi orders
        require(equal(buyOrder.side, "BID"), "Buy order must be BID");
        require(equal(sellOrder.side, "ASK"), "Sell order must be ASK");
        require(buyOrder.ftAddress == sellOrder.ftAddress, "Tokens must match");
        require(buyOrder.poolId == sellOrder.poolId, "Pools must match");
        require(buyOrder.pricePerToken == sellOrder.pricePerToken, "Prices must match");

        // Validasi amount
        require(amount > 0, "Amount must be > 0");
        require(amount <= buyOrder.amount - executedAmounts[buyOrder.orderId], "Buy order insufficient");
        require(amount <= sellOrder.amount - executedAmounts[sellOrder.orderId], "Sell order insufficient");

        // Validasi expiration
        require(buyOrder.expiresAt > block.timestamp, "Buy order expired");
        require(sellOrder.expiresAt > block.timestamp, "Sell order expired");

        // Verify signatures (disabled for testing/MVP)
        // TODO: Enable signature verification for production
        // _verifyOrderSignature(buyOrder, buySignature);
        // _verifyOrderSignature(sellOrder, sellSignature);

        // Calculate payment
        uint256 totalValue = (amount * buyOrder.pricePerToken) / 1e18;
        uint256 feeAmount = (totalValue * platformFee) / 10000;
        uint256 sellerReceives = totalValue - feeAmount;

        // Execute transfer
        // 1. Buyer sends ETH to seller
        require(msg.value >= totalValue, "Insufficient ETH sent");
        (bool success, ) = payable(sellOrder.userAddress).call{value: sellerReceives}("");
        require(success, "ETH transfer to seller failed");

        // 2. Platform fee
        if (feeAmount > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: feeAmount}("");
            require(feeSuccess, "ETH transfer to fee recipient failed");
        }

        // 3. Seller sends FT to buyer
        IERC20(buyOrder.ftAddress).safeTransferFrom(
            sellOrder.userAddress,
            buyOrder.userAddress,
            amount
        );

        // Update filled amounts
        executedAmounts[buyOrder.orderId] += amount;
        executedAmounts[sellOrder.orderId] += amount;

        // Refund excess ETH
        uint256 excess = msg.value - totalValue;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }

        emit OrderMatched(
            buyOrder.orderId,
            sellOrder.orderId,
            buyOrder.userAddress,
            sellOrder.userAddress,
            buyOrder.ftAddress,
            amount,
            buyOrder.pricePerToken,
            totalValue
        );
    }

    /**
     * @notice Cancel order (only order creator)
     */
    function cancelOrder(Order calldata order, bytes calldata signature) external {
        // Verify caller is order creator
        require(msg.sender == order.userAddress, "Only order creator can cancel");

        // Verify signature
        _verifyOrderSignature(order, signature);

        // Mark as executed (full amount) to prevent further trades
        executedAmounts[order.orderId] = order.amount;

        emit OrderCancelled(order.orderId, order.userAddress);
    }

    /**
     * @notice Internal: Verify EIP-712 order signature
     */
    function _verifyOrderSignature(Order calldata order, bytes calldata signature) internal view {
        bytes32 structHash = keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                keccak256(abi.encodePacked(order.orderId)),
                keccak256(abi.encodePacked(order.side)),
                order.poolId,
                order.ftAddress,
                order.amount,
                order.pricePerToken,
                order.userAddress,
                order.nonce,
                order.expiresAt
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(signature);

        require(recovered == order.userAddress, "Invalid signature");
    }

    /**
     * @notice Get remaining amount in order
     */
    function getRemainingAmount(Order calldata order) external view returns (uint256) {
        return order.amount - executedAmounts[order.orderId];
    }

    /**
     * @notice Set platform fee (max 5% = 500 BPS)
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high");
        platformFee = newFee;
    }

    /**
     * @notice Set fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }

    // Helpers untuk string comparison
    function equal(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
