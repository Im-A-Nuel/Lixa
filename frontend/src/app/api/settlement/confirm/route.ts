import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { recordTradeStats } from "@/lib/tradeStats";

const prisma = new PrismaClient();

interface ConfirmSettlementRequest {
  matchId: string;
  txHash: string;
  blockNumber?: number;
}

/**
 * POST /api/settlement/confirm
 * Record settlement after on-chain execution is confirmed
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConfirmSettlementRequest = await request.json();
    const { matchId, txHash } = body;

    if (!matchId || !txHash) {
      return NextResponse.json(
        { error: "Missing matchId or txHash" },
        { status: 400 }
      );
    }

    // Get match with orders
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

    // Update match with tx details (schema tidak punya blockNumber)
    const updatedMatch = await prisma.orderMatch.update({
      where: { id: matchId },
      data: {
        status: "SETTLED",
        txHash,
        settledAt: new Date(),
      },
    });

    // Log settlement
    if (match.buyOrder && match.sellOrder) {
      await Promise.all([
        prisma.orderHistory.create({
          data: {
            orderId: match.buyOrder.id,
            action: "SETTLED_ONCHAIN",
            amount: match.matchedAmount,
            details: JSON.stringify({
              matchId,
              txHash,
              timestamp: new Date().toISOString(),
            }),
          },
        }),
        prisma.orderHistory.create({
          data: {
            orderId: match.sellOrder.id,
            action: "SETTLED_ONCHAIN",
            amount: match.matchedAmount,
            details: JSON.stringify({
              matchId,
              txHash,
              timestamp: new Date().toISOString(),
            }),
          },
        }),
      ]);
    }

    // Update trade statistics for price/volume charts
    if (match.buyOrder && match.sellOrder) {
      await recordTradeStats(prisma, {
        ftAddress: match.buyOrder.ftAddress,
        poolId: match.buyOrder.poolId,
        matchedAmountWei: match.matchedAmount,
        matchedPriceWei: match.matchedPrice,
      });
    }

    return NextResponse.json({
      success: true,
      match: updatedMatch,
    });
  } catch (error) {
    console.error("Error confirming settlement:", error);
    return NextResponse.json(
      { error: "Failed to confirm settlement", details: (error as Error).message },
      { status: 500 }
    );
  }
}
