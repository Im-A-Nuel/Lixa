import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const normalizedUser = userAddress?.toLowerCase();
    const ftAddress = searchParams.get("ftAddress");
    const normalizedFt = ftAddress?.toLowerCase();
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 100;

    const filters: any[] = [];

    if (ftAddress) {
      filters.push({
        OR: [
          { buyOrder: { ftAddress } },
          { buyOrder: { ftAddress: normalizedFt } },
        ],
      });
    }

    if (userAddress) {
      filters.push({
        OR: [
          { buyOrder: { userAddress } },
          { buyOrder: { userAddress: normalizedUser } },
          { sellOrder: { userAddress } },
          { sellOrder: { userAddress: normalizedUser } },
        ],
      });
    }

    const trades = await prisma.orderMatch.findMany({
      where: {
        status: {
          in: ["SETTLED", "SETTLEMENT_EXECUTED"],
        },
        AND: filters,
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

    const ftAddresses = Array.from(new Set(trades.map((t) => t.buyOrder?.ftAddress).filter(Boolean) as string[]));

    const tokens = await prisma.fractionalToken.findMany({
      where: { ftAddress: { in: ftAddresses } },
    });

    const tokenMap = tokens.reduce<Record<string, { ftSymbol?: string; ftName?: string }>>((acc, token) => {
      acc[token.ftAddress.toLowerCase()] = { ftSymbol: token.ftSymbol, ftName: token.ftName };
      return acc;
    }, {});

    const formatted = trades.map((trade) => {
      const key = trade.buyOrder.ftAddress.toLowerCase();
      const tokenMeta = tokenMap[key] || {};
      const totalValueWei = (BigInt(trade.matchedAmount) * BigInt(trade.matchedPrice)) / BigInt(1e18);

      let side: "BUY" | "SELL" | null = null;
      if (userAddress) {
        const normalized = userAddress.toLowerCase();
        if (trade.buyOrder.userAddress.toLowerCase() === normalized) side = "BUY";
        if (trade.sellOrder.userAddress.toLowerCase() === normalized) side = "SELL";
      }

      return {
        id: trade.id,
        poolId: trade.buyOrder.poolId,
        ftAddress: trade.buyOrder.ftAddress,
        ftSymbol: tokenMeta.ftSymbol,
        ftName: tokenMeta.ftName,
        buyerAddress: trade.buyOrder.userAddress,
        sellerAddress: trade.sellOrder.userAddress,
        matchedAmount: trade.matchedAmount,
        matchedPrice: trade.matchedPrice,
        totalValue: totalValueWei.toString(),
        status: trade.status,
        createdAt: trade.createdAt.toISOString(),
        settledAt: trade.settledAt?.toISOString(),
        side,
      };
    });

    return NextResponse.json({
      success: true,
      count: formatted.length,
      trades: formatted,
    });
  } catch (error) {
    console.error("Error fetching trade history:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade history" },
      { status: 500 }
    );
  }
}
