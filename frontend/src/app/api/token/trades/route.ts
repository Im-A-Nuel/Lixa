import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ftAddress = searchParams.get("ftAddress");
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
    const poolId = searchParams.get("poolId");
    const addressLc = ftAddress?.toLowerCase();

    if (!ftAddress) {
      return NextResponse.json(
        { error: "ftAddress parameter is required" },
        { status: 400 }
      );
    }

    const token = await prisma.fractionalToken.findFirst({
      where: {
        OR: [
          { ftAddress: addressLc },
          ...(poolId ? [{ poolId }] : []),
        ],
      },
    });

    // Fetch settled matches for this token, sorted by most recent
    const trades = await prisma.orderMatch.findMany({
      where: {
        status: {
          in: ["SETTLED", "SETTLEMENT_EXECUTED", "PENDING_EXECUTION"],
        },
        AND: [
          {
            buyOrder: {
              ftAddress: addressLc,
            },
          },
          ...(poolId ? [{ buyOrder: { poolId: poolId.toString() } }] : []),
        ],
      },
      include: {
        buyOrder: true,
        sellOrder: true,
      },
      orderBy: [
        { settledAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    const formattedTrades = trades.map((trade) => ({
      id: trade.id,
      buyerAddress: trade.buyOrder.userAddress,
      sellerAddress: trade.sellOrder.userAddress,
      poolId: trade.buyOrder.poolId,
      ftAddress: trade.buyOrder.ftAddress,
      ftSymbol: token?.ftSymbol,
      ftName: token?.ftName,
      matchedAmount: trade.matchedAmount,
      matchedPrice: trade.matchedPrice,
      gasFeeAmount: trade.gasFeeAmount,
      createdAt: trade.createdAt.toISOString(),
      settledAt: trade.settledAt?.toISOString(),
      status: trade.status,
      txHash: trade.txHash,
    }));

    return NextResponse.json({
      ftAddress,
      trades: formattedTrades,
      count: trades.length,
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
