import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Multi-layer duplicate detection API
 *
 * Detection layers (in order):
 * 1. Exact duplicate: CID (IPFS Content Identifier) - same bytes = same CID
 * 2. Exact duplicate: SHA-256 file hash - secondary verification
 * 3. Near-duplicate: Perceptual hash - detects similar content despite modifications
 *
 * This prevents both exact duplicates and near-duplicates (re-encoded, resized, etc.)
 */

/**
 * Calculate Hamming distance between two hex strings
 */
function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return Infinity;

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    distance += xor.toString(2).split('1').length - 1;
  }
  return distance;
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== MULTI-LAYER DUPLICATE CHECK ===");
    const body = await req.json();
    const { ipfsCid, fileHash, perceptualHash, mimeType, creator } = body;

    console.log("Request:", { ipfsCid, fileHash, perceptualHash, mimeType, creator });

    // Validate required fields
    if (!fileHash) {
      return NextResponse.json(
        { error: "File hash is required" },
        { status: 400 }
      );
    }

    // ========================================
    // LAYER 1: Exact duplicate check via CID
    // ========================================
    if (ipfsCid) {
      console.log("[Layer 1] Checking CID:", ipfsCid);
      const cidMatch = await prisma.asset.findUnique({
        where: { ipfsCid },
        select: {
          id: true,
          assetId: true,
          creator: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          ipfsCid: true,
          fileHash: true,
          createdAt: true,
          status: true,
        },
      });

      if (cidMatch) {
        const isSameCreator = cidMatch.creator.toLowerCase() === creator?.toLowerCase();
        console.log("[Layer 1] EXACT DUPLICATE FOUND (CID match)");

        return NextResponse.json({
          isDuplicate: true,
          duplicateType: "exact",
          matchLayer: "cid",
          asset: cidMatch,
          isSameCreator,
          confidence: 1.0,
          message: isSameCreator
            ? "You have already uploaded this exact file (CID match)"
            : "This exact file has already been uploaded by another creator (CID match)",
        });
      }
    }

    // ========================================
    // LAYER 2: Exact duplicate check via SHA-256
    // ========================================
    console.log("[Layer 2] Checking SHA-256:", fileHash);
    const hashMatch = await prisma.asset.findFirst({
      where: { fileHash },
      select: {
        id: true,
        assetId: true,
        creator: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        ipfsCid: true,
        fileHash: true,
        createdAt: true,
        status: true,
      },
    });

    if (hashMatch) {
      const isSameCreator = hashMatch.creator.toLowerCase() === creator?.toLowerCase();
      console.log("[Layer 2] EXACT DUPLICATE FOUND (hash match)");

      return NextResponse.json({
        isDuplicate: true,
        duplicateType: "exact",
        matchLayer: "sha256",
        asset: hashMatch,
        isSameCreator,
        confidence: 1.0,
        message: isSameCreator
          ? "You have already uploaded this exact file (hash match)"
          : "This exact file has already been uploaded by another creator (hash match)",
      });
    }

    // ========================================
    // LAYER 3: Near-duplicate check via perceptual hash
    // ========================================
    if (perceptualHash && mimeType?.startsWith('image/')) {
      console.log("[Layer 3] Checking perceptual hash:", perceptualHash);

      // Get all assets with perceptual hashes of the same type (images)
      const similarCandidates = await prisma.asset.findMany({
        where: {
          perceptualHash: { not: null },
          mimeType: { startsWith: 'image/' },
        },
        select: {
          id: true,
          assetId: true,
          creator: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          ipfsCid: true,
          fileHash: true,
          perceptualHash: true,
          perceptualType: true,
          createdAt: true,
          status: true,
        },
      });

      // Calculate Hamming distances and find similar assets
      const SIMILARITY_THRESHOLD = 10; // Hamming distance <= 10 (tunable)
      const similarAssets = similarCandidates
        .map((asset) => {
          if (!asset.perceptualHash) return null;
          const distance = hammingDistance(perceptualHash, asset.perceptualHash);
          return { asset, distance };
        })
        .filter((item): item is { asset: any; distance: number } =>
          item !== null && item.distance <= SIMILARITY_THRESHOLD
        )
        .sort((a, b) => a.distance - b.distance);

      if (similarAssets.length > 0) {
        const bestMatch = similarAssets[0];
        const isSameCreator = bestMatch.asset.creator.toLowerCase() === creator?.toLowerCase();
        const confidence = 1 - (bestMatch.distance / 64); // Normalize to 0-1

        console.log(`[Layer 3] NEAR-DUPLICATE FOUND (Hamming distance: ${bestMatch.distance})`);

        return NextResponse.json({
          isDuplicate: true,
          duplicateType: "near",
          matchLayer: "perceptual",
          asset: bestMatch.asset,
          isSameCreator,
          confidence,
          hammingDistance: bestMatch.distance,
          similarAssets: similarAssets.slice(0, 5).map(s => ({
            asset: s.asset,
            distance: s.distance,
            confidence: 1 - (s.distance / 64),
          })),
          message: isSameCreator
            ? `You may have already uploaded a similar file (${Math.round(confidence * 100)}% similar)`
            : `A similar file has been uploaded by another creator (${Math.round(confidence * 100)}% similar)`,
        });
      }
    }

    // ========================================
    // NO DUPLICATE FOUND
    // ========================================
    console.log("No duplicates found - file is unique");
    return NextResponse.json({
      isDuplicate: false,
      message: "File is unique and can be uploaded",
    });
  } catch (error) {
    console.error("Error checking duplicate:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicates" },
      { status: 500 }
    );
  }
}
