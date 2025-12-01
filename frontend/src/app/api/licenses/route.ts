import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const buyer = req.nextUrl.searchParams.get("buyer");
    const assetId = req.nextUrl.searchParams.get("assetId");

    const where: any = {};
    if (buyer) where.buyer = buyer.toLowerCase();
    if (assetId) where.assetId = parseInt(assetId);

    const licenses = await prisma.license.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ licenses });
  } catch (error) {
    console.error("Error fetching licenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch licenses" },
      { status: 500 }
    );
  }
}
