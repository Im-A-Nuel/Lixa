import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/settlement/sign-order
 * Prepare order data untuk signing di frontend
 * User akan sign dengan wallet mereka menggunakan EIP-712
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId,
      side, // "BID" atau "ASK"
      poolId,
      ftAddress,
      amount,
      pricePerToken,
      userAddress,
      nonce,
      expiresAt,
    } = body;

    if (
      !orderId ||
      !side ||
      !poolId ||
      !ftAddress ||
      !amount ||
      !pricePerToken ||
      !userAddress ||
      !expiresAt
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Prepare order structure untuk EIP-712 signing
    // Domain separator
    const domain = {
      name: "Lixa Order Book",
      version: "1",
      chainId: 31337, // Foundry
      verifyingContract: "0xa513e6e4b8f2a923d98304ec87f64353c4d5c853", // OrderBook address
    };

    // Message types untuk EIP-712
    const types = {
      Order: [
        { name: "orderId", type: "string" },
        { name: "side", type: "string" },
        { name: "poolId", type: "uint256" },
        { name: "ftAddress", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "pricePerToken", type: "uint256" },
        { name: "userAddress", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
      ],
    };

    // Message value
    const message = {
      orderId,
      side,
      poolId: parseInt(poolId),
      ftAddress,
      amount,
      pricePerToken,
      userAddress,
      nonce: nonce || 0,
      expiresAt: Math.floor(new Date(expiresAt).getTime() / 1000),
    };

    return NextResponse.json({
      success: true,
      signData: {
        domain,
        types,
        primaryType: "Order",
        message,
      },
      instructions:
        "User harus sign ini dengan wallet mereka menggunakan personal_sign atau eth_signTypedData_v4",
    });
  } catch (error) {
    console.error("Error preparing order for signing:", error);
    return NextResponse.json(
      {
        error: "Failed to prepare order",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
