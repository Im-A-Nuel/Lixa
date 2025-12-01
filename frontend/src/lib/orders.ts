import { Address, Hash, TypedDataDomain, TypedDataField } from "viem";

/**
 * Offchain Order System untuk Bid/Ask
 * User sign message untuk create order, kemudian dapat di-match dan settle onchain
 */

export type OrderSide = "BID" | "ASK";
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "EXPIRED";

export interface OffchainOrder {
  // Order metadata
  orderId: string;
  chainId: number;
  userAddress: Address;

  // Order details
  side: OrderSide; // BID atau ASK
  poolId: bigint;
  ftAddress: Address;

  // Amount dan price
  amount: bigint; // Jumlah token (18 decimals)
  pricePerToken: bigint; // Harga per token (dalam ETH, 18 decimals)

  // Timing
  createdAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp

  // Status tracking
  status: OrderStatus;
  filledAmount: bigint; // Sudah di-fill berapa banyak

  // EIP-712 Signature
  signature?: string;
  nonce: number; // Prevent replay
}

export interface BidOrder extends OffchainOrder {
  side: "BID";
  // Buyer offers ETH untuk membeli FT
}

export interface AskOrder extends OffchainOrder {
  side: "ASK";
  // Seller offers FT dengan harga minimum
}

/**
 * EIP-712 Domain Separator untuk signing
 */
export function getOrderDomain(chainId: number): TypedDataDomain {
  return {
    name: "Lixa Order Book",
    version: "1",
    chainId,
    verifyingContract: "0x0000000000000000000000000000000000000000", // Bisa jadi contract address atau constant
  };
}

/**
 * EIP-712 Type Definition untuk Order
 */
export const ORDER_TYPES: Record<string, TypedDataField[]> = {
  Order: [
    { name: "orderId", type: "string" },
    { name: "side", type: "string" }, // "BID" atau "ASK"
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
 * Validasi order sebelum sign
 */
export function validateOrder(order: OffchainOrder): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!order.orderId) errors.push("Order ID harus diisi");
  if (!order.ftAddress) errors.push("FT Address harus diisi");
  if (order.amount <= 0n) errors.push("Amount harus lebih dari 0");
  if (order.pricePerToken <= 0n) errors.push("Price per token harus lebih dari 0");
  if (order.expiresAt <= Date.now() / 1000) errors.push("Order sudah expired");
  if (order.nonce < 0) errors.push("Nonce invalid");

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate total value dari order
 */
export function calculateOrderValue(order: OffchainOrder): bigint {
  return (order.amount * order.pricePerToken) / BigInt(1e18);
}

/**
 * Check apakah order sudah expired
 */
export function isOrderExpired(order: OffchainOrder): boolean {
  return order.expiresAt < Math.floor(Date.now() / 1000);
}

/**
 * Check apakah order fully filled
 */
export function isOrderFullyFilled(order: OffchainOrder): boolean {
  return order.filledAmount >= order.amount;
}

/**
 * Get remaining amount yang dapat di-fill
 */
export function getRemainingAmount(order: OffchainOrder): bigint {
  return order.amount - order.filledAmount;
}
