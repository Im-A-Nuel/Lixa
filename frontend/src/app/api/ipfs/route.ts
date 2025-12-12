import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.PINATA_JWT) {
    return NextResponse.json({ error: "PINATA_JWT not set" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const name = (form.get("name") as string | null) ?? "Asset";
  const description = (form.get("description") as string | null) ?? "";
  const mimeType = file?.type || "application/octet-stream";
  const filename = file?.name || "asset";

  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  try {
    // Upload binary file to Pinata
    const fileData = new FormData();
    fileData.append("file", file, file.name);

    const fileRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: fileData,
    });
    const fileJson = await fileRes.json();
    if (!fileRes.ok) {
      return NextResponse.json({ error: fileJson }, { status: 500 });
    }
    const imageUri = `ipfs://${fileJson.IpfsHash}`;

    // Upload metadata JSON
    const metadata = {
      name,
      description,
      image: imageUri,
      properties: {
        mimeType,
        filename,
      },
    };

    const metaRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });
    const metaJson = await metaRes.json();
    if (!metaRes.ok) {
      return NextResponse.json({ error: metaJson }, { status: 500 });
    }

    return NextResponse.json({
      metadataUri: `ipfs://${metaJson.IpfsHash}`,
      metadataURI: `ipfs://${metaJson.IpfsHash}`, // For compatibility
      imageUri,
      ipfsHash: fileJson.IpfsHash, // Return the CID of the actual file
      IpfsHash: fileJson.IpfsHash, // For compatibility
      cid: fileJson.IpfsHash, // Standard CID field
    });
  } catch (err) {
    console.error("IPFS upload error", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
