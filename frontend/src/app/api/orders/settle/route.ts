import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getPublicClient } from "@/lib/viem";
import { formatUnits } from "viem";
import { recordTradeStats } from "@/lib/tradeStats";

const prisma = new PrismaClient();

interface SettleRequest {
  matchId: string;
  userAddress: string;
  chainId: number;
  txHash?: string; // Optional: provide if already settled on-chain
}

/**
 * POST /api/orders/settle
 * Settle an order match - transfer tokens from seller to buyer
 * In production, this would be triggered by on-chain settlement contract
 * For now, we simulate the settlement by updating database
 */
export async function POST(request: NextRequest) {
  try {
    const body: SettleRequest = await request.json();
    const { matchId, userAddress, chainId, txHash } = body;

    if (!matchId || !userAddress || !chainId) {
      return NextResponse.json(
        { error: "Missing required fields: matchId, userAddress, chainId" },
        { status: 400 }
      );
    }

    // Get the match record
    const orderMatch = await prisma.orderMatch.findUnique({
      where: { id: matchId },
      include: {
        buyOrder: true,
        sellOrder: true,
      },
    });

    if (!orderMatch) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    // Check if already settled
    if (orderMatch.status === "SETTLED") {
      return NextResponse.json(
        { error: "Match already settled" },
        { status: 400 }
      );
    }

    // Verify caller is either buyer or seller
    const isBuyer = userAddress.toLowerCase() === orderMatch.buyOrder.userAddress.toLowerCase();
    const isSeller = userAddress.toLowerCase() === orderMatch.sellOrder.userAddress.toLowerCase();

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { error: "Unauthorized - you are not part of this match" },
        { status: 403 }
      );
    }

    // In production, you would verify on-chain settlement here
    // For now, we just mark it as SETTLED and record the tx hash if provided
    const settledMatch = await prisma.orderMatch.update({
      where: { id: matchId },
      data: {
        status: "SETTLED",
        txHash: txHash || null,
        settledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log settlement
    await Promise.all([
      prisma.orderHistory.create({
        data: {
          orderId: orderMatch.buyOrder.id,
          action: "SETTLED",
          amount: orderMatch.matchedAmount,
          details: JSON.stringify({
            matchId,
            price: orderMatch.matchedPrice,
            txHash: txHash || "simulated",
          }),
        },
      }),
      prisma.orderHistory.create({
        data: {
          orderId: orderMatch.sellOrder.id,
          action: "SETTLED",
          amount: orderMatch.matchedAmount,
          details: JSON.stringify({
            matchId,
            price: orderMatch.matchedPrice,
            txHash: txHash || "simulated",
          }),
        },
      }),
    ]);

    await recordTradeStats(prisma, {
      ftAddress: orderMatch.buyOrder.ftAddress,
      poolId: orderMatch.buyOrder.poolId,
      matchedAmountWei: orderMatch.matchedAmount,
      matchedPriceWei: orderMatch.matchedPrice,
    });

    return NextResponse.json({
      success: true,
      match: settledMatch,
      message: "Order settlement completed",
    });
  } catch (error) {
    console.error("Error settling order:", error);
    return NextResponse.json(
      { error: "Failed to settle order", details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/settle?matchId=xxx
 * Get settlement status for a match
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json(
        { error: "Missing matchId parameter" },
        { status: 400 }
      );
    }

    const orderMatch = await prisma.orderMatch.findUnique({
      where: { id: matchId },
      include: {
        buyOrder: {
          select: { id: true, userAddress: true, amount: true, side: true },
        },
        sellOrder: {
          select: { id: true, userAddress: true, amount: true, side: true },
        },
      },
    });

    if (!orderMatch) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    const formattedAmount = formatUnits(BigInt(orderMatch.matchedAmount), 18);
    const formattedPrice = formatUnits(BigInt(orderMatch.matchedPrice), 18);

    return NextResponse.json({
      success: true,
      match: {
        id: orderMatch.id,
        buyOrderId: orderMatch.buyOrderId,
        sellOrderId: orderMatch.sellOrderId,
        buyerAddress: orderMatch.buyOrder.userAddress,
        sellerAddress: orderMatch.sellOrder.userAddress,
        matchedAmount: orderMatch.matchedAmount,
        formattedAmount,
        matchedPrice: orderMatch.matchedPrice,
        formattedPrice,
        status: orderMatch.status,
        txHash: orderMatch.txHash,
        createdAt: orderMatch.createdAt,
        settledAt: orderMatch.settledAt,
      },
    });
  } catch (error) {
    console.error("Error fetching settlement status:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlement status", details: (error as Error).message },
      { status: 500 }
    );
  }
}
