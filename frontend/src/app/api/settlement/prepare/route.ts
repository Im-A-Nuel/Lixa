import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PrepareSettlementRequest {
  matchId: string;
}

/**
 * GET /api/settlement/prepare?matchId=xxx
 * Get match details untuk di-pass ke executeTrade on-chain
 */
export async function GET(request: NextRequest) {
  try {
    const matchId = request.nextUrl.searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json(
        { error: "Missing matchId" },
        { status: 400 }
      );
    }

    // Get match with order details
    const match = await prisma.orderMatch.findUnique({
      where: { id: matchId },
      include: {
        buyOrder: true,
        sellOrder: true,
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    // Check if match is cancelled
    if (match.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Match has been cancelled", details: "One or both orders were cancelled" },
        { status: 400 }
      );
    }

    if (!match.buyOrder || !match.sellOrder) {
      return NextResponse.json(
        { error: "Match orders not found - order may have been cancelled", details: "One or both orders were cancelled before settlement" },
        { status: 404 }
      );
    }

    // Return match data formatted for on-chain execution
    return NextResponse.json({
      success: true,
      match: {
        matchId: match.id,
        buyOrderId: match.buyOrder.id,
        sellOrderId: match.sellOrder.id,
        buyerAddress: match.buyOrder.userAddress,
        sellerAddress: match.sellOrder.userAddress,
        ftAddress: match.buyOrder.ftAddress,
        poolId: match.buyOrder.poolId,
        amount: match.matchedAmount, // wei format
        pricePerToken: match.matchedPrice, // wei format
        expiresAt: Math.floor(match.buyOrder.expiresAt.getTime() / 1000), // unix timestamp
        buyOrderExpiry: Math.floor(match.buyOrder.expiresAt.getTime() / 1000),
        sellOrderExpiry: Math.floor(match.sellOrder.expiresAt.getTime() / 1000),
      },
    });
  } catch (error) {
    console.error("Error in prepare settlement:", error);
    return NextResponse.json(
      { error: "Failed to prepare settlement", details: (error as Error).message },
      { status: 500 }
    );
  }
}
