import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * POST /api/orders/cancel
 * Cancel an order (only if not filled)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, userAddress } = body;

    if (!orderId || !userAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify ownership
    if (order.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized - you do not own this order" },
        { status: 403 }
      );
    }

    // Cannot cancel if fully filled
    if (order.status === "FILLED") {
      return NextResponse.json(
        { error: "Cannot cancel - order is already filled" },
        { status: 400 }
      );
    }

    // Log cancellation before deletion (audit trail)
    await prisma.orderHistory.create({
      data: {
        orderId,
        action: "CANCELLED",
        amount: order.amount,
        details: JSON.stringify({
          filledAmount: order.filledAmount,
          reason: "User cancelled",
          deletedAt: new Date().toISOString(),
        }),
      },
    });

    // Cancel all pending matches related to this order
    await prisma.orderMatch.updateMany({
      where: {
        OR: [
          { buyOrderId: orderId, status: "PENDING_EXECUTION" },
          { sellOrderId: orderId, status: "PENDING_EXECUTION" },
        ],
      },
      data: {
        status: "CANCELLED",
      },
    });

    // Hard delete the order
    await prisma.order.delete({
      where: { id: orderId },
    });

    return NextResponse.json({
      success: true,
      message: "Order cancelled and deleted",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: "Failed to cancel order", details: (error as Error).message },
      { status: 500 }
    );
  }
}
