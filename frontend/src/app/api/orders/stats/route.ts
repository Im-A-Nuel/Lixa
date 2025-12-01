import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/orders/stats?poolId=1&ftAddress=0x123...
 * Get market statistics - seperti stock exchange
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const poolId = searchParams.get("poolId");
    const ftAddress = searchParams.get("ftAddress");

    const where: any = {
      expiresAt: {
        gt: new Date(),
      },
    };

    if (poolId) where.poolId = poolId;
    if (ftAddress) where.ftAddress = ftAddress.toLowerCase();

    // Get all open/active orders
    const orders = await prisma.order.findMany({
      where,
    });

    // Calculate stats
    const buyOrders = orders.filter((o) => o.side === "BUY");
    const sellOrders = orders.filter((o) => o.side === "SELL");

    let totalBuyVolume = BigInt(0);
    let totalSellVolume = BigInt(0);
    let highestBid = BigInt(0);
    let lowestAsk = BigInt("99999999999999999999999999");

    buyOrders.forEach((order) => {
      const remaining = BigInt(order.amount) - BigInt(order.filledAmount);
      totalBuyVolume += remaining;
      const price = BigInt(order.pricePerToken);
      if (price > highestBid) highestBid = price;
    });

    sellOrders.forEach((order) => {
      const remaining = BigInt(order.amount) - BigInt(order.filledAmount);
      totalSellVolume += remaining;
      const price = BigInt(order.pricePerToken);
      if (price < lowestAsk) lowestAsk = price;
    });

    // Calculate spread
    const spread =
      lowestAsk !== BigInt("99999999999999999999999999") && highestBid > BigInt(0)
        ? (lowestAsk - highestBid).toString()
        : "0";

    return NextResponse.json({
      success: true,
      orderBook: {
        bidCount: buyOrders.length,
        askCount: sellOrders.length,
        bidVolume: totalBuyVolume.toString(),
        askVolume: totalSellVolume.toString(),
        highestBid: highestBid > BigInt(0) ? highestBid.toString() : "0",
        lowestAsk: lowestAsk !== BigInt("99999999999999999999999999") ? lowestAsk.toString() : "0",
        spread,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: (error as Error).message },
      { status: 500 }
    );
  }
}
