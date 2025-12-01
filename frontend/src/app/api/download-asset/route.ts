import { NextRequest, NextResponse } from "next/server";
import { ipfsHttpGateways } from "@/lib/ipfs";

// Proxy download to force filename/Content-Disposition
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const filenameRaw = req.nextUrl.searchParams.get("filename") || "asset.glb";
  const filename = filenameRaw.includes(".") ? filenameRaw : `${filenameRaw}.glb`;
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  // If ipfs://, expand gateways
  const sources = url.startsWith("ipfs://") ? ipfsHttpGateways(url) : [url];

  for (const src of sources) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      const extHint =
        filename.includes(".") ? "" :
        contentType.includes("gltf") || contentType.includes("glb") ? ".glb" :
        "";
      const finalName = extHint && !filename.endsWith(extHint) ? `${filename}${extHint}` : filename;
      return new NextResponse(Buffer.from(arrayBuffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${finalName}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (err) {
      console.error("download-asset proxy failed for", src, err);
      continue;
    }
  }

  return NextResponse.json({ error: "Failed to fetch asset" }, { status: 502 });
}
