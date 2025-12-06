import { NextRequest, NextResponse } from "next/server";
import { Address, verifyTypedData, getAddress } from "viem";
import { OffchainOrder, ORDER_TYPES, getOrderDomain } from "@/lib/orders";

// In-memory order storage (dalam production gunakan database seperti MongoDB)
const orderBook = new Map<string, OffchainOrder>();
const userOrders = new Map<Address, string[]>();

/**
 * Serialize order untuk JSON response (convert BigInt to string)
 */
function serializeOrder(order: OffchainOrder) {
  return {
    ...order,
    poolId: order.poolId.toString(),
    amount: order.amount.toString(),
    pricePerToken: order.pricePerToken.toString(),
    filledAmount: order.filledAmount.toString(),
  };
}

/**
 * Validate order signature menggunakan EIP-712
 */
async function validateOrderSignature(order: OffchainOrder): Promise<boolean> {
  if (!order.signature) return false;

  try {
    const valid = await verifyTypedData({
      address: order.userAddress,
      domain: getOrderDomain(order.chainId),
      types: ORDER_TYPES,
      primaryType: "Order",
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
      signature: order.signature as `0x${string}`,
    });

    return valid;
  } catch (err) {
    console.error("[Orders API] Signature verification failed:", err);
    return false;
  }
}

/**
 * GET /api/orders - Fetch orders
 * Query params:
 *   - userAddress: Filter by user (optional)
 *   - side: "BID" or "ASK" (optional)
 *   - poolId: Filter by pool (optional)
 *   - chainId: Filter by chain (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get("userAddress")?.toLowerCase();
    const side = searchParams.get("side") as "BID" | "ASK" | null;
    const poolId = searchParams.get("poolId");
    const chainId = searchParams.get("chainId");

    let filtered = Array.from(orderBook.values());

    // Filter by user
    if (userAddress) {
      filtered = filtered.filter((o) => o.userAddress.toLowerCase() === userAddress);
    }

    // Filter by side
    if (side) {
      filtered = filtered.filter((o) => o.side === side);
    }

    // Filter by pool
    if (poolId) {
      filtered = filtered.filter((o) => o.poolId.toString() === poolId);
    }

    // Filter by chain
    if (chainId) {
      filtered = filtered.filter((o) => o.chainId.toString() === chainId);
    }

    // Filter expired orders
    const now = Math.floor(Date.now() / 1000);
    const active = filtered.filter((o) => o.expiresAt > now && o.status === "OPEN");

    return NextResponse.json({
      orders: active.map(serializeOrder),
      total: active.length,
    });
  } catch (err) {
    console.error("[Orders API] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

/**
 * POST /api/orders - Create new order
 * Body: OffchainOrder dengan signature
 */
export async function POST(req: NextRequest) {
  try {
    const rawOrder = await req.json();

    // Convert string values to BigInt
    const order: OffchainOrder = {
      ...rawOrder,
      poolId: BigInt(rawOrder.poolId),
      amount: BigInt(rawOrder.amount),
      pricePerToken: BigInt(rawOrder.pricePerToken),
      filledAmount: BigInt(rawOrder.filledAmount),
    };

    // Validate required fields
    if (!order.orderId || !order.signature) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if order already exists
    if (orderBook.has(order.orderId)) {
      return NextResponse.json({ error: "Order already exists" }, { status: 409 });
    }

    // Verify EIP-712 signature
    if (!(await validateOrderSignature(order))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (order.expiresAt <= now) {
      return NextResponse.json({ error: "Order already expired" }, { status: 400 });
    }

    // Store order
    orderBook.set(order.orderId, order);

    // Track user's orders
    const userAddr = getAddress(order.userAddress);
    if (!userOrders.has(userAddr)) {
      userOrders.set(userAddr, []);
    }
    userOrders.get(userAddr)!.push(order.orderId);

    console.log(`[Orders API] Order created: ${order.orderId} (${order.side})`);

    return NextResponse.json(serializeOrder(order), { status: 201 });
  } catch (err) {
    console.error("[Orders API] POST failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create order" },
      { status: 500 }
    );
  }
}
