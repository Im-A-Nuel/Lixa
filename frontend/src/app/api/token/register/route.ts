import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * POST /api/token/register
 * Register a new fractional token with unique symbol constraint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      poolId,
      ftAddress,
      ftName,
      ftSymbol,
      assetId,
      imageUrl,
      description,
    } = body;

    // Validate required fields
    if (!poolId || !ftAddress || !ftName || !ftSymbol || assetId === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: poolId, ftAddress, ftName, ftSymbol, assetId" },
        { status: 400 }
      );
    }

    // Check if symbol already exists
    const existingToken = await prisma.fractionalToken.findUnique({
      where: { ftSymbol: ftSymbol.toUpperCase() },
    });

    if (existingToken) {
      return NextResponse.json(
        {
          error: `Symbol "${ftSymbol.toUpperCase()}" is already taken. Please use a different symbol.`,
          existingToken: existingToken,
        },
        { status: 409 } // Conflict status
      );
    }

    // Check if ftAddress already exists
    const existingAddress = await prisma.fractionalToken.findUnique({
      where: { ftAddress: ftAddress.toLowerCase() },
    });

    if (existingAddress) {
      return NextResponse.json(
        {
          error: "This token address is already registered",
          existingToken: existingAddress,
        },
        { status: 409 }
      );
    }

    // Check if poolId already exists
    const existingPool = await prisma.fractionalToken.findUnique({
      where: { poolId: poolId.toString() },
    });

    if (existingPool) {
      return NextResponse.json(
        {
          error: "This pool is already registered",
          existingToken: existingPool,
        },
        { status: 409 }
      );
    }

    // Create the fractional token record
    const token = await prisma.fractionalToken.create({
      data: {
        poolId: poolId.toString(),
        ftAddress: ftAddress.toLowerCase(),
        ftName,
        ftSymbol: ftSymbol.toUpperCase(),
        assetId,
        imageUrl: imageUrl || null,
        description: description || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        token,
        message: `Token "${ftSymbol}" registered successfully!`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering token:", error);
    return NextResponse.json(
      {
        error: "Failed to register token",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
