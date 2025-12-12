import { Address, TypedDataDomain } from "viem";

/**
 * Offchain Order System for Bid/Ask
 * User signs message to create order, then can be matched and settled on-chain
 */

// Define TypedDataField type for EIP-712
type TypedDataField = {
  name: string;
  type: string;
};

export type OrderSide = "BID" | "ASK";
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "EXPIRED";

export interface OffchainOrder {
  // Order metadata
  orderId: string;
  chainId: number;
  userAddress: Address;

  // Order details
  side: OrderSide; // BID or ASK
  poolId: bigint;
  ftAddress: Address;

  // Amount and price
  amount: bigint; // Token amount (18 decimals)
  pricePerToken: bigint; // Price per token (in IP, 18 decimals)

  // Timing
  createdAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp

  // Status tracking
  status: OrderStatus;
  filledAmount: bigint; // Amount already filled

  // EIP-712 Signature
  signature?: string;
  nonce: number; // Prevent replay
}

export interface BidOrder extends OffchainOrder {
  side: "BID";
  // Buyer offers IP to buy FT
}

export interface AskOrder extends OffchainOrder {
  side: "ASK";
  // Seller offers FT with minimum price
}

/**
 * EIP-712 Domain Separator for signing
 */
export function getOrderDomain(chainId: number): TypedDataDomain {
  return {
    name: "Lixa Order Book",
    version: "1",
    chainId,
    verifyingContract: "0x0000000000000000000000000000000000000000", // Can be contract address or constant
  };
}

/**
 * EIP-712 Type Definition untuk Order
 */
export const ORDER_TYPES: Record<string, TypedDataField[]> = {
  Order: [
    { name: "orderId", type: "string" },
    { name: "side", type: "string" }, // "BID" or "ASK"
    { name: "poolId", type: "uint256" },
    { name: "ftAddress", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "pricePerToken", type: "uint256" },
    { name: "userAddress", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
};

/**
 * Create order signature payload untuk EIP-712 signing
 */
export function createOrderSignaturePayload(order: OffchainOrder) {
  return {
    types: ORDER_TYPES,
    primaryType: "Order",
    domain: getOrderDomain(order.chainId),
    message: {
      orderId: order.orderId,
      side: order.side,
      poolId: order.poolId.toString(),
      ftAddress: order.ftAddress,
      amount: order.amount.toString(),
      pricePerToken: order.pricePerToken.toString(),
      userAddress: order.userAddress,
      nonce: order.nonce,
      expiresAt: order.expiresAt,
    },
  };
}

/**
 * Validate order before signing
 */
export function validateOrder(order: OffchainOrder): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!order.orderId) errors.push("Order ID is required");
  if (!order.ftAddress) errors.push("FT Address is required");
  if (order.amount <= BigInt(0)) errors.push("Amount must be greater than 0");
  if (order.pricePerToken <= BigInt(0)) errors.push("Price per token must be greater than 0");
  if (order.expiresAt <= Date.now() / 1000) errors.push("Order has expired");
  if (order.nonce < 0) errors.push("Invalid nonce");

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate total value of order
 */
export function calculateOrderValue(order: OffchainOrder): bigint {
  return (order.amount * order.pricePerToken) / BigInt(1e18);
}

/**
 * Check if order has expired
 */
export function isOrderExpired(order: OffchainOrder): boolean {
  return order.expiresAt < Math.floor(Date.now() / 1000);
}

/**
 * Check if order is fully filled
 */
export function isOrderFullyFilled(order: OffchainOrder): boolean {
  return order.filledAmount >= order.amount;
}

/**
 * Get remaining amount that can be filled
 */
export function getRemainingAmount(order: OffchainOrder): bigint {
  return order.amount - order.filledAmount;
}
