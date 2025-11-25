"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import Link from "next/link";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import Header from "@/components/Header";

export default function MarketplacePage() {
  const { chainId } = useAccount();
  const registryAddress = chainId
    ? getContractAddress(chainId, "AssetRegistry")
    : undefined;

  const { data: totalAssets } = useReadContract({
    address: registryAddress,
    abi: AssetRegistryABI,
    functionName: "totalAssets",
  });

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Marketplace</h1>
            <p className="text-gray-400 mt-1">
              {totalAssets
                ? `${totalAssets.toString()} assets listed`
                : "Browse game assets"}
            </p>
          </div>
          <Link
            href="/create"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
          >
            + List Asset
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-8">
          <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
            All Assets
          </button>
          <button className="px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg transition text-gray-400">
            3D Models
          </button>
          <button className="px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg transition text-gray-400">
            Sprites
          </button>
          <button className="px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg transition text-gray-400">
            Music
          </button>
          <button className="px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg transition text-gray-400">
            UI Kits
          </button>
        </div>

        {/* Asset Grid */}
        {!totalAssets || totalAssets === BigInt(0) ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              No assets yet
            </h3>
            <p className="text-gray-500 mb-6">
              Be the first to list your game asset!
            </p>
            <Link
              href="/create"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
            >
              List Your Asset
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {/* Asset cards will be mapped here */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition">
              <div className="aspect-square bg-gray-800 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-1">
                  Asset #{totalAssets?.toString()}
                </h3>
                <p className="text-sm text-gray-400 mb-3">5% royalty</p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">
                    Commercial
                  </span>
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                    Fractionalized
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
