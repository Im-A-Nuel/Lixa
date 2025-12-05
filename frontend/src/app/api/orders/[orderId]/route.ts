import { NextRequest, NextResponse } from "next/server";

// Referensi ke order storage (dalam production, implement dengan database)
// Untuk sekarang kita hardcode, tapi di production ini harus di-persist

/**
 * GET /api/orders/[orderId] - Get specific order
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;

    // TODO: Query database untuk fetch order
    // const order = await db.orders.findOne({ orderId });

    // Placeholder response
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 }
    );
  } catch (err) {
    console.error("[Orders API] GET single failed:", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

/**
 * DELETE /api/orders/[orderId] - Cancel order
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;

    // TODO: Implement order cancellation
    // 1. Verify order exists
    // 2. Verify caller is order creator
    // 3. Update order status to CANCELLED

    return NextResponse.json({
      message: "Order cancelled",
      orderId,
    });
  } catch (err) {
    console.error("[Orders API] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
  }
}
