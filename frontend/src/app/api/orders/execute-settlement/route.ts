import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getPublicClient } from "@/lib/viem";
import { parseUnits, encodeFunctionData } from "viem";
import OrderBookABI from "@/lib/contracts/OrderBook.json";

const prisma = new PrismaClient();

interface ExecuteSettlementRequest {
  matchId: string;
  buyOrderId: string;
  sellOrderId: string;
  matchAmount: string;
  buyerAddress: string;
  sellerAddress: string;
  ftAddress: string;
  pricePerToken: string;
  chainId: number;
  txHash: string; // Transaction hash from on-chain execution
}

/**
 * POST /api/orders/execute-settlement
 * Execute settlement on-chain and record in database
 * Called after OrderBook.executeTrade() is confirmed
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExecuteSettlementRequest = await request.json();
    const {
      matchId,
      buyOrderId,
      sellOrderId,
      matchAmount,
      buyerAddress,
      sellerAddress,
      ftAddress,
      pricePerToken,
      chainId,
      txHash,
    } = body;

    if (!matchId || !txHash) {
      return NextResponse.json(
        { error: "Missing required fields: matchId, txHash" },
        { status: 400 }
      );
    }

    // Get the match record
    const orderMatch = await prisma.orderMatch.findUnique({
      where: { id: matchId },
    });

    if (!orderMatch) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      );
    }

    // Update match with tx hash and on-chain settlement
    const settledMatch = await prisma.orderMatch.update({
      where: { id: matchId },
      data: {
        status: "SETTLED",
        txHash,
        settledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log on-chain settlement
    await Promise.all([
      prisma.orderHistory.create({
        data: {
          orderId: buyOrderId,
          action: "SETTLED_ONCHAIN",
          amount: matchAmount,
          details: JSON.stringify({
            matchId,
            txHash,
            type: "on-chain execution",
            price: pricePerToken,
          }),
        },
      }),
      prisma.orderHistory.create({
        data: {
          orderId: sellOrderId,
          action: "SETTLED_ONCHAIN",
          amount: matchAmount,
          details: JSON.stringify({
            matchId,
            txHash,
            type: "on-chain execution",
            price: pricePerToken,
          }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      match: settledMatch,
      message: "Settlement recorded on-chain",
      txHash,
    });
  } catch (error) {
    console.error("Error executing settlement:", error);
    return NextResponse.json(
      { error: "Failed to execute settlement", details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/execute-settlement?txHash=0x...
 * Get settlement details by transaction hash
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const txHash = searchParams.get("txHash");

    if (!txHash) {
      return NextResponse.json(
        { error: "Missing txHash parameter" },
        { status: 400 }
      );
    }

    const match = await prisma.orderMatch.findFirst({
      where: { txHash },
    });

    if (!match) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      match,
    });
  } catch (error) {
    console.error("Error fetching settlement:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlement", details: (error as Error).message },
      { status: 500 }
    );
  }
}
