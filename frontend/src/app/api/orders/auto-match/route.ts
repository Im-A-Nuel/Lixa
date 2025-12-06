import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  validateOrderMatch,
  calculateGasFee,
  calculateSettlementPrice,
  findBestMatch,
} from "@/lib/orderMatching";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

interface AutoMatchRequest {
  orderId: string;
}

/**
 * POST /api/orders/auto-match
 * Automatically match a new order with compatible orders from opposite side
 */
export async function POST(request: NextRequest) {
  try {
    const body: AutoMatchRequest = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    // Get the new order
    const newOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!newOrder || newOrder.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Order not found or cancelled" },
        { status: 404 }
      );
    }

    const matches: any[] = [];
    let currentOrder = newOrder;

    // Keep matching until order is fully filled or no matches found
    while (
      BigInt(currentOrder.filledAmount) < BigInt(currentOrder.amount) &&
      new Date() < currentOrder.expiresAt
    ) {
      // Get all compatible orders from opposite side
      const oppositeOrders = await prisma.order.findMany({
        where: {
          side: currentOrder.side === "BUY" ? "SELL" : "BUY",
          poolId: currentOrder.poolId,
          ftAddress: currentOrder.ftAddress,
          status: "OPEN",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });

      if (oppositeOrders.length === 0) {
        break; // No more matching orders
      }

      // Find best match based on price and time priority
      const bestMatch = findBestMatch(currentOrder, oppositeOrders);

      if (!bestMatch) {
        break; // No valid match found
      }

      // Calculate maximum amount we can match
      const currentAvailable = BigInt(currentOrder.amount) - BigInt(currentOrder.filledAmount);
      const matchAvailable = BigInt(bestMatch.amount) - BigInt(bestMatch.filledAmount);
      const matchAmount = currentAvailable < matchAvailable ? currentAvailable : matchAvailable;

      // Validate match
      const validation = validateOrderMatch(
        currentOrder.side === "BUY" ? currentOrder : bestMatch,
        currentOrder.side === "SELL" ? currentOrder : bestMatch,
        matchAmount.toString()
      );

      if (!validation.valid) {
        break; // Cannot match - break out of loop
      }

      // Calculate settlement price
      const buyOrder = currentOrder.side === "BUY" ? currentOrder : bestMatch;
      const sellOrder = currentOrder.side === "SELL" ? currentOrder : bestMatch;

      const settlementPrice = calculateSettlementPrice(
        buyOrder.pricePerToken,
        sellOrder.pricePerToken,
        true // Use seller price
      );

      // Calculate gas fee
      const gasFeePercentage =
        parseFloat(process.env.NEXT_PUBLIC_DEFAULT_GAS_FEE_PERCENTAGE || "0.001");

      const gasFee = calculateGasFee(
        matchAmount.toString(),
        settlementPrice,
        gasFeePercentage
      );

      // Create match record
      const matchId = uuidv4();
      const orderMatch = await prisma.orderMatch.create({
        data: {
          id: matchId,
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
          matchedAmount: matchAmount.toString(),
          matchedPrice: settlementPrice,
          gasFeePercentage,
          gasFeeAmount: gasFee,
          status: "PENDING_EXECUTION", // Waiting for on-chain execution
          settledAt: null, // Will be set when on-chain tx confirmed
        },
      });

      // Update filled amounts
      const newBuyFilled = (BigInt(buyOrder.filledAmount) + matchAmount).toString();
      const newSellFilled = (BigInt(sellOrder.filledAmount) + matchAmount).toString();

      // Determine new status
      const buyAvailable = BigInt(buyOrder.amount) - BigInt(newBuyFilled);
      const sellAvailable = BigInt(sellOrder.amount) - BigInt(newSellFilled);

      const buyStatus = buyAvailable === BigInt(0) ? "FILLED" : "PARTIALLY_FILLED";
      const sellStatus = sellAvailable === BigInt(0) ? "FILLED" : "PARTIALLY_FILLED";

      // Update both orders
      await Promise.all([
        prisma.order.update({
          where: { id: buyOrder.id },
          data: {
            filledAmount: newBuyFilled,
            status: buyStatus,
            updatedAt: new Date(),
          },
        }),
        prisma.order.update({
          where: { id: sellOrder.id },
          data: {
            filledAmount: newSellFilled,
            status: sellStatus,
            updatedAt: new Date(),
          },
        }),
      ]);

      // Log matches (waiting for on-chain execution)
      await Promise.all([
        prisma.orderHistory.create({
          data: {
            orderId: buyOrder.id,
            action: "MATCHED",
            amount: matchAmount.toString(),
            details: JSON.stringify({
              matchId,
              price: settlementPrice,
              gasFee,
              autoMatched: true,
              pendingOnChainExecution: true,
            }),
          },
        }),
        prisma.orderHistory.create({
          data: {
            orderId: sellOrder.id,
            action: "MATCHED",
            amount: matchAmount.toString(),
            details: JSON.stringify({
              matchId,
              price: settlementPrice,
              gasFee,
              autoMatched: true,
              pendingOnChainExecution: true,
            }),
          },
        }),
      ]);

      matches.push({
        matchId,
        matchedWith: bestMatch.id,
        matchedAmount: matchAmount.toString(),
        matchedPrice: settlementPrice,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyerAddress: buyOrder.userAddress,
        sellerAddress: sellOrder.userAddress,
        ftAddress: buyOrder.ftAddress,
        poolId: buyOrder.poolId,
        status: "PENDING_EXECUTION",
        requiresOnChainExecution: true,
      });

      // Update current order for next iteration
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!updatedOrder) break;
      currentOrder = updatedOrder;
    }

    return NextResponse.json({
      success: true,
      orderId,
      matchesCreated: matches.length,
      matches,
    });
  } catch (error) {
    console.error("Error in auto-match:", error);
    return NextResponse.json(
      { error: "Auto-match failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
