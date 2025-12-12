import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * API endpoint to register a new asset after upload
 * Creates a record in the database with IPFS CID for deduplication
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ipfsCid,
      fileHash,
      creator,
      fileName,
      fileSize,
      mimeType,
      ipfsHash,
      metadataURI,
      assetId, // Optional: only set after on-chain registration
      // Perceptual hashing fields (for near-duplicate detection)
      perceptualHash,
      perceptualType,
      // Canonicalization info (for images)
      canonicalWidth,
      canonicalHeight,
      canonicalFormat,
    } = body;

    // Validate required fields
    if (!ipfsCid || !fileHash || !creator || !fileName || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if asset with this CID already exists
    const existingAsset = await prisma.asset.findUnique({
      where: { ipfsCid },
    });

    if (existingAsset) {
      return NextResponse.json(
        {
          error: "This file has already been uploaded (CID match)",
          existingAsset,
        },
        { status: 409 } // Conflict
      );
    }

    // Create new asset record with perceptual hash data
    const asset = await prisma.asset.create({
      data: {
        ipfsCid,
        fileHash,
        creator: creator.toLowerCase(), // Normalize address
        fileName,
        fileSize,
        mimeType,
        ipfsHash,
        metadataURI,
        assetId: assetId ? Number(assetId) : null,
        status: assetId ? "REGISTERED" : "UPLOADED",
        // Perceptual hashing for near-duplicate detection
        perceptualHash: perceptualHash || null,
        perceptualType: perceptualType || null,
        // Canonicalization metadata
        canonicalWidth: canonicalWidth ? Number(canonicalWidth) : null,
        canonicalHeight: canonicalHeight ? Number(canonicalHeight) : null,
        canonicalFormat: canonicalFormat || null,
      },
    });

    return NextResponse.json({
      success: true,
      asset,
      message: "Asset registered successfully with duplicate detection metadata",
    });
  } catch (error: any) {
    console.error("Error registering asset:", error);

    // Handle unique constraint violation
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target?.includes('ipfsCid')) {
        return NextResponse.json(
          { error: "This file has already been uploaded (CID conflict)" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "This file conflicts with an existing asset" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to register asset" },
      { status: 500 }
    );
  }
}

/**
 * Update asset with on-chain assetId after blockchain registration
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ipfsCid, assetId } = body;

    if (!ipfsCid || assetId === undefined) {
      return NextResponse.json(
        { error: "IPFS CID and asset ID are required" },
        { status: 400 }
      );
    }

    // Update asset with on-chain ID
    const asset = await prisma.asset.update({
      where: { ipfsCid },
      data: {
        assetId: Number(assetId),
        status: "REGISTERED",
      },
    });

    return NextResponse.json({
      success: true,
      asset,
      message: "Asset updated with on-chain ID",
    });
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 }
    );
  }
}
