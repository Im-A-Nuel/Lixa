import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET(req: NextRequest) {
  let prisma: any = null;

  try {
    prisma = new PrismaClient();

    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get("assetId");
    const buyerAddress = searchParams.get("buyerAddress");

    if (!assetId || !buyerAddress) {
      return NextResponse.json(
        { error: "Missing assetId or buyerAddress" },
        { status: 400 }
      );
    }

    const buyer = buyerAddress.toLowerCase();

    // Check if license exists
    const license = await prisma.license.findFirst({
      where: {
        assetId: parseInt(assetId),
        buyer,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      hasLicense: !!license,
      license: license || null,
    });
  } catch (error) {
    console.error("License check error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check license",
        hasLicense: false,
        license: null
      },
      { status: 500 }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
}
