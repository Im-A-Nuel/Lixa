import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/orders/list?side=BUY&poolId=1&status=OPEN
 * Get orders dengan filter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const side = searchParams.get("side"); // BUY, SELL, or null for all
    const poolId = searchParams.get("poolId");
    const ftAddress = searchParams.get("ftAddress");
    const userAddress = searchParams.get("userAddress");
    const status = searchParams.get("status"); // OPEN, FILLED, CANCELLED, etc
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build filter
    const where: any = {
      expiresAt: {
        gt: new Date(), // Not expired
      },
    };

    if (side) {
      where.side = side;
    }
    if (poolId) {
      where.poolId = poolId;
    }
    if (ftAddress) {
      where.ftAddress = ftAddress.toLowerCase();
    }
    if (userAddress) {
      where.userAddress = userAddress.toLowerCase();
    }
    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await prisma.order.count({ where });

    // Get orders
    const orders = await prisma.order.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Calculate market stats
    const allOrders = await prisma.order.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
        ...(poolId && { poolId }),
      },
      select: {
        side: true,
        amount: true,
        filledAmount: true,
        pricePerToken: true,
      },
    });

    const buyOrders = allOrders.filter((o) => o.side === "BUY");
    const sellOrders = allOrders.filter((o) => o.side === "SELL");

    let highestBid = "0";
    let lowestAsk = "0";

    if (buyOrders.length > 0) {
      const prices = buyOrders.map((o) => BigInt(o.pricePerToken));
      highestBid = prices.reduce((a, b) => (a > b ? a : b)).toString();
    }

    if (sellOrders.length > 0) {
      const prices = sellOrders.map((o) => BigInt(o.pricePerToken));
      lowestAsk = prices.reduce((a, b) => (a < b ? a : b)).toString();
    }

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      marketData: {
        highestBid,
        lowestAsk,
        bidCount: buyOrders.length,
        askCount: sellOrders.length,
        spread: lowestAsk !== "0" && highestBid !== "0"
          ? (BigInt(lowestAsk) - BigInt(highestBid)).toString()
          : "0",
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders", details: (error as Error).message },
      { status: 500 }
    );
  }
}
