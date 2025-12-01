import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { validateOrder } from "@/lib/orders";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

/**
 * POST /api/orders/create
 * Create new buy or sell order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userAddress,
      side, // "BUY" or "SELL"
      poolId,
      ftAddress,
      amount,
      pricePerToken,
      chainId,
      signature,
      nonce,
      expiresAt,
    } = body;

    // Validate required fields
    if (!userAddress || !side || !poolId || !ftAddress || !amount || !pricePerToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["BUY", "SELL"].includes(side)) {
      return NextResponse.json(
        { error: "Invalid order side. Must be BUY or SELL" },
        { status: 400 }
      );
    }

    // Validate amounts
    try {
      BigInt(amount);
      BigInt(pricePerToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid amount or price format" },
        { status: 400 }
      );
    }

    // Check expiration
    const expiryDate = new Date(expiresAt);
    if (expiryDate <= new Date()) {
      return NextResponse.json(
        { error: "Order already expired" },
        { status: 400 }
      );
    }

    // Create order
    const orderId = uuidv4();
    const totalValue = (BigInt(amount) * BigInt(pricePerToken)) / BigInt(1e18);

    const order = await prisma.order.create({
      data: {
        orderId,
        userAddress: userAddress.toLowerCase(),
        side,
        poolId,
        ftAddress: ftAddress.toLowerCase(),
        amount,
        pricePerToken,
        totalValue: totalValue.toString(),
        chainId,
        signature,
        nonce: nonce || 0,
        expiresAt: expiryDate,
        status: "OPEN",
        filledAmount: "0",
      },
    });

    // Log order creation
    await prisma.orderHistory.create({
      data: {
        orderId,
        action: "CREATED",
        amount,
        details: JSON.stringify({
          side,
          price: pricePerToken,
          userAddress: userAddress.toLowerCase(),
        }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        order,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order", details: (error as Error).message },
      { status: 500 }
    );
  }
}
