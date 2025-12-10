import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  validateOrderMatch,
  calculateGasFee,
  calculateSettlementPrice,
} from "@/lib/orderMatching";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

interface MatchRequest {
  buyOrderId: string;
  sellOrderId: string;
  matchAmount: string;
}

/**
 * POST /api/orders/match
 * Match buy order with sell order and calculate gas fee
 */
export async function POST(request: NextRequest) {
  try {
    const body: MatchRequest = await request.json();

    const { buyOrderId, sellOrderId, matchAmount } = body;

    if (!buyOrderId || !sellOrderId || !matchAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch orders
    const buyOrder = await prisma.order.findUnique({
      where: { id: buyOrderId },
    });
    const sellOrder = await prisma.order.findUnique({
      where: { id: sellOrderId },
    });

    if (!buyOrder || !sellOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate match
    const validation = validateOrderMatch(
      {
        id: buyOrder.id,
        userAddress: buyOrder.userAddress,
        side: buyOrder.side,
        poolId: buyOrder.poolId,
        ftAddress: buyOrder.ftAddress,
        amount: buyOrder.amount,
        filledAmount: buyOrder.filledAmount,
        pricePerToken: buyOrder.pricePerToken,
        status: buyOrder.status,
        expiresAt: buyOrder.expiresAt,
      },
      {
        id: sellOrder.id,
        userAddress: sellOrder.userAddress,
        side: sellOrder.side,
        poolId: sellOrder.poolId,
        ftAddress: sellOrder.ftAddress,
        amount: sellOrder.amount,
        filledAmount: sellOrder.filledAmount,
        pricePerToken: sellOrder.pricePerToken,
        status: sellOrder.status,
        expiresAt: sellOrder.expiresAt,
      },
      matchAmount
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Order validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // Calculate settlement price (use sell price for fairer calculation)
    const settlementPrice = calculateSettlementPrice(
      buyOrder.pricePerToken,
      sellOrder.pricePerToken,
      true
    );

    // Get gas fee percentage from env or default 0.1%
    const gasFeePercentage =
      parseFloat(process.env.NEXT_PUBLIC_DEFAULT_GAS_FEE_PERCENTAGE || "0.001");

    // Calculate gas fee
    const gasFee = calculateGasFee(
      matchAmount,
      settlementPrice,
      gasFeePercentage
    );

    // Create match record
    const matchId = uuidv4();
    const orderMatch = await prisma.orderMatch.create({
      data: {
        id: matchId,
        buyOrderId,
        sellOrderId,
        matchedAmount: matchAmount,
        matchedPrice: settlementPrice,
        gasFeePercentage,
        gasFeeAmount: gasFee,
        status: "PENDING",
      },
    });

    // Update filled amounts for both orders
    const newBuyFilled = (
      BigInt(buyOrder.filledAmount) + BigInt(matchAmount)
    ).toString();
    const newSellFilled = (
      BigInt(sellOrder.filledAmount) + BigInt(matchAmount)
    ).toString();

    // Determine new status
    const buyAvailable = BigInt(buyOrder.amount) - BigInt(newBuyFilled);
    const sellAvailable = BigInt(sellOrder.amount) - BigInt(newSellFilled);

    const buyStatus =
      buyAvailable === BigInt(0)
        ? "FILLED"
        : "PARTIALLY_FILLED";
    const sellStatus =
      sellAvailable === BigInt(0)
        ? "FILLED"
        : "PARTIALLY_FILLED";

    // Update both orders atomically
    await Promise.all([
      prisma.order.update({
        where: { id: buyOrderId },
        data: {
          filledAmount: newBuyFilled,
          status: buyStatus,
          updatedAt: new Date(),
        },
      }),
      prisma.order.update({
        where: { id: sellOrderId },
        data: {
          filledAmount: newSellFilled,
          status: sellStatus,
          updatedAt: new Date(),
        },
      }),
    ]);

    // Log match
    await prisma.orderHistory.create({
      data: {
        orderId: buyOrderId,
        action: "PARTIALLY_FILLED",
        amount: matchAmount,
        details: JSON.stringify({
          matchId,
          price: settlementPrice,
          gasFee,
        }),
      },
    });

    await prisma.orderHistory.create({
      data: {
        orderId: sellOrderId,
        action: "PARTIALLY_FILLED",
        amount: matchAmount,
        details: JSON.stringify({
          matchId,
          price: settlementPrice,
          gasFee,
        }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        match: orderMatch,
        updatedBuyOrder: {
          filledAmount: newBuyFilled,
          status: buyStatus,
        },
        updatedSellOrder: {
          filledAmount: newSellFilled,
          status: sellStatus,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error matching orders:", error);
    return NextResponse.json(
      { error: "Failed to match orders", details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/match?buyOrderId=xxx&sellOrderId=yyy&matchAmount=zzz
 * Preview match result without creating
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const buyOrderId = searchParams.get("buyOrderId");
    const sellOrderId = searchParams.get("sellOrderId");
    const matchAmount = searchParams.get("matchAmount");

    if (!buyOrderId || !sellOrderId || !matchAmount) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const buyOrder = await prisma.order.findUnique({
      where: { id: buyOrderId },
    });
    const sellOrder = await prisma.order.findUnique({
      where: { id: sellOrderId },
    });

    if (!buyOrder || !sellOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate
    const validation = validateOrderMatch(
      {
        id: buyOrder.id,
        userAddress: buyOrder.userAddress,
        side: buyOrder.side,
        poolId: buyOrder.poolId,
        ftAddress: buyOrder.ftAddress,
        amount: buyOrder.amount,
        filledAmount: buyOrder.filledAmount,
        pricePerToken: buyOrder.pricePerToken,
        status: buyOrder.status,
        expiresAt: buyOrder.expiresAt,
      },
      {
        id: sellOrder.id,
        userAddress: sellOrder.userAddress,
        side: sellOrder.side,
        poolId: sellOrder.poolId,
        ftAddress: sellOrder.ftAddress,
        amount: sellOrder.amount,
        filledAmount: sellOrder.filledAmount,
        pricePerToken: sellOrder.pricePerToken,
        status: sellOrder.status,
        expiresAt: sellOrder.expiresAt,
      },
      matchAmount
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const settlementPrice = calculateSettlementPrice(
      buyOrder.pricePerToken,
      sellOrder.pricePerToken,
      true
    );

    const gasFeePercentage =
      parseFloat(process.env.NEXT_PUBLIC_DEFAULT_GAS_FEE_PERCENTAGE || "0.001");

    const gasFee = calculateGasFee(
      matchAmount,
      settlementPrice,
      gasFeePercentage
    );

    // Total cost to buyer
    const totalValue = (BigInt(matchAmount) * BigInt(settlementPrice)) / BigInt(1e18);
    const totalWithGas = totalValue + BigInt(gasFee);

    return NextResponse.json({
      success: true,
      valid: true,
      preview: {
        matchedAmount: matchAmount,
        matchedPrice: settlementPrice,
        gasFeePercentage,
        gasFeeAmount: gasFee,
        totalCost: totalWithGas.toString(),
        buyerSaves: (totalValue - BigInt(gasFee)).toString(),
      },
    });
  } catch (error) {
    console.error("Error previewing match:", error);
    return NextResponse.json(
      { error: "Failed to preview match", details: (error as Error).message },
      { status: 500 }
    );
  }
}
