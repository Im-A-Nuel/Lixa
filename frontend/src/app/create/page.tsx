"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import Link from "next/link";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";

export default function CreatePage() {
  const { isConnected, chainId } = useAccount();
  const [metadataURI, setMetadataURI] = useState("");
  const [royaltyBPS, setRoyaltyBPS] = useState("500"); // 5%

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registryAddress) return;

    writeContract({
      address: registryAddress,
      abi: AssetRegistryABI,
      functionName: "registerAsset",
      args: [metadataURI, Number(royaltyBPS)],
    });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Lixa
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link href="/marketplace" className="text-gray-400 hover:text-white transition">
                Marketplace
              </Link>
              <Link href="/create" className="text-white font-medium">
                Create
              </Link>
              <Link href="/portfolio" className="text-gray-400 hover:text-white transition">
                Portfolio
              </Link>
            </nav>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Register New Asset</h1>

        {!isConnected ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Connect your wallet to register assets</p>
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
                Metadata URI (IPFS)
              </label>
              <input
                type="text"
                value={metadataURI}
                onChange={(e) => setMetadataURI(e.target.value)}
                placeholder="ipfs://Qm..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload your asset metadata to IPFS first
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Default Royalty (%)
              </label>
              <input
                type="number"
                value={Number(royaltyBPS) / 100}
                onChange={(e) => setRoyaltyBPS(String(Number(e.target.value) * 100))}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Royalty percentage for secondary sales (0-100%)
              </p>
            </div>

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
              disabled={isPending || isConfirming}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
            >
              {isPending ? "Confirming..." : isConfirming ? "Waiting for confirmation..." : "Register Asset"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
