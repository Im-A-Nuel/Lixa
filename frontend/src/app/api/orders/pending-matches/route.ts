import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/orders/pending-matches
 * Fetch all pending matches waiting for on-chain settlement
 */
export async function GET() {
  try {
    const pendingMatches = await prisma.orderMatch.findMany({
      where: {
        status: "PENDING_EXECUTION",
      },
      include: {
        buyOrder: true,
        sellOrder: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format for frontend
    const formattedMatches = pendingMatches.map((match) => ({
      id: match.id,
      buyOrderId: match.buyOrderId,
      sellOrderId: match.sellOrderId,
      buyerAddress: match.buyOrder?.userAddress || "",
      sellerAddress: match.sellOrder?.userAddress || "",
      ftAddress: match.buyOrder?.ftAddress || "",
      poolId: match.buyOrder?.poolId || "",
      matchedAmount: match.matchedAmount,
      matchedPrice: match.matchedPrice,
      status: match.status,
      createdAt: match.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedMatches,
    });
  } catch (error) {
    console.error("Error fetching pending matches:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch pending matches",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
