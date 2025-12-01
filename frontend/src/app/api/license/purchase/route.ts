import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function POST(req: NextRequest) {
  let prisma: any = null;

  try {
    prisma = new PrismaClient();
    const { assetId, buyerAddress, priceInEth, licenseType, ltype, txHash, uri } = await req.json();

    if (!assetId || !buyerAddress || !priceInEth) {
      return NextResponse.json(
        { error: "Missing assetId, buyerAddress, or priceInEth" },
        { status: 400 }
      );
    }

    const normalizedBuyer = buyerAddress.toLowerCase();
    const numericType = typeof ltype === "number" ? ltype : typeof licenseType === "number" ? licenseType : undefined;
    const typeName =
      numericType === 1 ? "EXCLUSIVE" : numericType === 2 ? "DERIVATIVE" : (licenseType as string) || "NON_EXCLUSIVE";

    // Exclusive: only one per user per asset
    if (typeName === "EXCLUSIVE" || numericType === 1) {
      const existing = await prisma.license.findFirst({
        where: { assetId: parseInt(assetId), buyer: normalizedBuyer },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Exclusive license already owned by this address" },
          { status: 409 }
        );
      }
    }

    // Convert price to wei (assuming priceInEth is a string decimal like "0.1")
    const priceInWei = (parseFloat(priceInEth) * 1e18).toString();

    const license = await prisma.license.create({
      data: {
        assetId: parseInt(assetId),
        buyer: normalizedBuyer,
        price: priceInWei,
        status: "ACTIVE",
        licenseType: typeName.toUpperCase(),
        txHash,
        uri,
      },
    });

    return NextResponse.json({
      success: true,
      license,
      message: `License purchased for asset #${assetId}`,
    });
  } catch (error) {
    console.error("License purchase error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to purchase license",
        success: false
      },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
}
