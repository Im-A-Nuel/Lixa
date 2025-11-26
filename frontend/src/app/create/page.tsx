"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useState } from "react";
import Link from "next/link";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import Header from "@/components/Header";

export default function CreatePage() {
  const { isConnected, chainId } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [royaltyBPS, setRoyaltyBPS] = useState("500"); // 5%
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const registryAddress = chainId
    ? getContractAddress(chainId, "AssetRegistry")
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registryAddress || !file) return;

    try {
      setUploadError(null);
      setUploading(true);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name || "Asset");
      fd.append("description", description);

      const res = await fetch("/api/ipfs", {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) {
        const msg =
          typeof body?.error === "string"
            ? body.error
            : body?.error
            ? JSON.stringify(body.error)
            : "Upload failed";
        setUploadError(msg);
        setUploading(false);
        return;
      }

      const metadataURI = body.metadataUri ?? body.metadataURI;
      if (!metadataURI) {
        setUploadError("Metadata URI not returned");
        setUploading(false);
        return;
      }

      writeContract({
        address: registryAddress,
        abi: AssetRegistryABI,
        functionName: "registerAsset",
        args: [metadataURI, Number(royaltyBPS)],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Register New Asset</h1>

        {!isConnected ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">
              Connect your wallet to register assets
            </p>
            <ConnectButton />
          </div>
        ) : !registryAddress ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-yellow-400">
            Please switch to a supported network (Anvil local or Sepolia)
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Asset File
              </label>
              <input
                type="file"
                accept="image/*,video/*,model/*,.glb,.gltf,.fbx,.png,.jpg,.jpeg,.gif"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                File akan di-upload ke IPFS (Pinata) lalu metadata otomatis
                dibuat.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nama Asset
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama asset"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deskripsi
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sedikit penjelasan asset"
                rows={3}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Royalty (%)
              </label>
              <input
                type="number"
                value={Number(royaltyBPS) / 100}
                onChange={(e) =>
                  setRoyaltyBPS(String(Number(e.target.value) * 100))
                }
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Royalty percentage for secondary sales (0-100%)
              </p>
            </div>

            {uploadError && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
                Upload error: {uploadError}
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
                Error: {error.message}
              </div>
            )}

            {isSuccess && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-green-400">
                Asset registered successfully! TX: {hash}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || isConfirming || uploading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
            >
              {uploading
                ? "Uploading to IPFS..."
                : isPending
                ? "Confirming..."
                : isConfirming
                ? "Waiting for confirmation..."
                : "Register Asset"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
