import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds for large files

// IPFS gateways with good CORS support (ordered by reliability for 3D models)
const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://w3s.link/ipfs/",
];

// Fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cid = searchParams.get("cid");

  if (!cid) {
    return NextResponse.json({ error: "cid parameter required" }, { status: 400 });
  }

  console.log(`[IPFS Proxy] Fetching CID: ${cid}`);

  // Try each gateway until one succeeds
  let lastError: any = null;
  for (const gateway of GATEWAYS) {
    try {
      const url = `${gateway}${cid}`;
      console.log(`[IPFS Proxy] Trying gateway: ${url}`);

      const response = await fetchWithTimeout(url, 30000);

      if (!response.ok) {
        lastError = `Gateway ${gateway} returned ${response.status}`;
        console.warn(`[IPFS Proxy] ${lastError}`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const buffer = await response.arrayBuffer();

      console.log(`[IPFS Proxy] Success! Fetched ${buffer.byteLength} bytes from ${gateway}`);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Content-Type",
        },
      });
    } catch (err: any) {
      lastError = err.message || String(err);
      console.error(`[IPFS Proxy] Gateway ${gateway} failed:`, err.message);
      continue;
    }
  }

  console.error(`[IPFS Proxy] All gateways failed for CID ${cid}`);
  return NextResponse.json(
    { error: "All IPFS gateways failed", details: lastError },
    { status: 502 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}
