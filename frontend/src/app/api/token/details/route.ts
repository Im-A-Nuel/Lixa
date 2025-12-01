import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ftAddress = searchParams.get("ftAddress");
    const poolId = searchParams.get("poolId");

    if (!ftAddress) {
      return NextResponse.json(
        { error: "ftAddress parameter is required" },
        { status: 400 }
      );
    }

    const token = await prisma.fractionalToken.findFirst({
      where: {
        OR: [
          { ftAddress },
          { ftAddress: ftAddress.toLowerCase() },
          ...(poolId ? [{ poolId }] : []),
        ],
      },
    });

    if (!token) {
      // Return default values if token not yet registered
      return NextResponse.json({
        ftAddress,
        ftName: null,
        ftSymbol: null,
        imageUrl: null,
        description: null,
      });
    }

    return NextResponse.json({
      id: token.id,
      poolId: token.poolId,
      ftAddress: token.ftAddress,
      ftName: token.ftName,
      ftSymbol: token.ftSymbol,
      assetId: token.assetId,
      imageUrl: token.imageUrl,
      description: token.description,
      createdAt: token.createdAt,
    });
  } catch (error) {
    console.error("Error fetching token details:", error);
    return NextResponse.json(
      { error: "Failed to fetch token details" },
      { status: 500 }
    );
  }
}
