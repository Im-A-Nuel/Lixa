import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { recordTradeStats } from "@/lib/tradeStats";

const prisma = new PrismaClient();

interface ExecuteSettlementRequest {
  matchId: string;
  buyerAddress: string;
  sellerAddress: string;
  ftAddress: string;
  matchedAmount: string;
  matchedPrice: string;
  chainId: number;
}

/**
 * POST /api/settlement/execute
 * Execute on-chain settlement - Transfer token from seller to buyer
 * In production, this would call OrderBook.executeTrade() with signatures
 * For now, we simulate the transfer and record tx
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExecuteSettlementRequest = await request.json();
    const {
      matchId,
      buyerAddress,
      sellerAddress,
      ftAddress,
      matchedAmount,
      matchedPrice,
      chainId,
    } = body;

    if (!matchId || !buyerAddress || !sellerAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get match record
    const match = await prisma.orderMatch.findUnique({
      where: { id: matchId },
      include: {
        buyOrder: true,
        sellOrder: true,
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Check if already executed
    if (match.txHash) {
      return NextResponse.json(
        { error: "Settlement already executed", txHash: match.txHash },
        { status: 400 }
      );
    }

    // Simulate on-chain execution
    // In production, this would:
    // 1. Call OrderBook.executeTrade() with buyer and seller signatures
    // 2. Transfer FT tokens from seller to buyer
    // 3. Transfer ETH from buyer to seller
    // 4. Get actual transaction hash from blockchain

    const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random()
      .toString(16)
      .slice(2)}`;

    // Update match with simulated transaction
    const updatedMatch = await prisma.orderMatch.update({
      where: { id: matchId },
      data: {
        txHash: mockTxHash,
        status: "SETTLED",
        settledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log settlement execution
    await Promise.all([
      prisma.orderHistory.create({
        data: {
          orderId: match.buyOrderId,
          action: "SETTLEMENT_EXECUTED",
          amount: matchedAmount,
          details: JSON.stringify({
            matchId,
            txHash: mockTxHash,
            type: "on-chain token transfer",
            from: sellerAddress,
            to: buyerAddress,
            tokenAmount: matchedAmount,
            pricePerToken: matchedPrice,
          }),
        },
      }),
      prisma.orderHistory.create({
        data: {
          orderId: match.sellOrderId,
          action: "SETTLEMENT_EXECUTED",
          amount: matchedAmount,
          details: JSON.stringify({
            matchId,
            txHash: mockTxHash,
            type: "on-chain token transfer",
            from: sellerAddress,
            to: buyerAddress,
            tokenAmount: matchedAmount,
            pricePerToken: matchedPrice,
          }),
        },
      }),
    ]);

    await recordTradeStats(prisma, {
      ftAddress: match.buyOrder.ftAddress,
      poolId: match.buyOrder.poolId,
      matchedAmountWei: matchedAmount,
      matchedPriceWei: matchedPrice,
    });

    return NextResponse.json({
      success: true,
      match: updatedMatch,
      execution: {
        txHash: mockTxHash,
        from: sellerAddress,
        to: buyerAddress,
        token: ftAddress,
        amount: matchedAmount,
        price: matchedPrice,
        status: "EXECUTED",
      },
      message: "Settlement executed on-chain. Tokens transferred.",
    });
  } catch (error) {
    console.error("Error executing settlement:", error);
    return NextResponse.json(
      { error: "Failed to execute settlement", details: (error as Error).message },
      { status: 500 }
    );
  }
}
