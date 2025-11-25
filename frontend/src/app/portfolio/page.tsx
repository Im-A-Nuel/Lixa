"use client";

import { useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import Link from "next/link";
import { formatUnits } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

export default function PortfolioPage() {
  const { address, chainId, isConnected } = useAccount();
  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;

  // Registered assets
  const { data: totalAssets } = useReadContract({
    address: registryAddress,
    abi: AssetRegistryABI,
    functionName: "totalAssets",
  });

  const assetQueries = useMemo(() => {
    if (!registryAddress || !totalAssets || totalAssets === 0n) return [];
    return Array.from({ length: Number(totalAssets) }, (_, idx) => ({
      address: registryAddress,
      abi: AssetRegistryABI,
      functionName: "getAsset",
      args: [BigInt(idx + 1)],
    }));
  }, [registryAddress, totalAssets]);

  const { data: assetsData } = useReadContracts({
    contracts: assetQueries,
    query: { enabled: assetQueries.length > 0 },
  });

  const registeredAssets = useMemo(() => {
    if (!assetsData || !address) return [];
    return assetsData
      .map((entry) => {
        if (!entry || entry.status !== "success") return null;
        const a: any = entry.result;
        if (!a?.exists) return null;
        if (a.creator.toLowerCase() !== address.toLowerCase()) return null;
        return a;
      })
      .filter(Boolean) as any[];
  }, [assetsData, address]);

  // Fractional holdings
  const { data: totalPools } = useReadContract({
    address: fractionalizerAddress,
    abi: FractionalizerABI,
    functionName: "totalPools",
  });

  const poolQueries = useMemo(() => {
    if (!fractionalizerAddress || !totalPools || totalPools === 0n) return [];
    return Array.from({ length: Number(totalPools) }, (_, idx) => ({
      address: fractionalizerAddress,
      abi: FractionalizerABI,
      functionName: "poolInfo",
      args: [BigInt(idx + 1)],
    }));
  }, [fractionalizerAddress, totalPools]);

  const { data: poolData } = useReadContracts({
    contracts: poolQueries,
    query: { enabled: poolQueries.length > 0 },
  });

  const balanceQueries = useMemo(() => {
    if (!poolData || !address) return [];
    return poolData.map((entry) => {
      if (!entry || entry.status !== "success") return null;
      const [, , ftAddress] = entry.result as any;
      return {
        address: ftAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      };
    }).filter(Boolean) as any[];
  }, [poolData, address]);

  const { data: balancesData } = useReadContracts({
    contracts: balanceQueries,
    query: { enabled: balanceQueries.length > 0 },
  });

  const fractionalHoldings = useMemo(() => {
    if (!poolData || !balancesData) return [];
    return poolData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        if (!balancesData[idx] || balancesData[idx].status !== "success") return null;
        const bal = balancesData[idx].result as bigint;
        if (bal === 0n) return null;
        const [nftContract, tokenId, ftAddress, totalFractions, originalOwner, , amountForSale, sold, active] =
          entry.result as any;
        return {
          id: idx + 1,
          nftContract,
          tokenId,
          ftAddress,
          totalFractions,
          originalOwner,
          amountForSale,
          sold,
          active,
          balance: bal,
        };
      })
      .filter(Boolean) as {
      id: number;
      nftContract: string;
      tokenId: bigint;
      ftAddress: string;
      totalFractions: bigint;
      originalOwner: string;
      amountForSale: bigint;
      sold: bigint;
      active: boolean;
      balance: bigint;
    }[];
  }, [poolData, balancesData]);

  const { writeContract, data: claimHash, error: claimError } = useWriteContract();
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });

  const handleClaim = (poolId: number) => {
    writeContract({
      address: fractionalizerAddress!,
      abi: FractionalizerABI,
      functionName: "claimDividends",
      args: [BigInt(poolId)],
    });
  };

  return (
    <div className="min-h-screen">
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
              <Link href="/pools" className="text-gray-400 hover:text-white transition">
                Pools
              </Link>
              <Link href="/fractionalize" className="text-gray-400 hover:text-white transition">
                Fractionalize
              </Link>
              <Link href="/licenses" className="text-gray-400 hover:text-white transition">
                Licenses
              </Link>
              <Link href="/create" className="text-gray-400 hover:text-white transition">
                Create
              </Link>
              <Link href="/portfolio" className="text-white font-medium">
                Portfolio
              </Link>
            </nav>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
          <p className="text-gray-400">Your registered assets and fractional token balances.</p>
        </div>

        {!isConnected ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to view your portfolio.</p>
            <ConnectButton />
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Registered Assets</h2>
              {registeredAssets.length === 0 ? (
                <p className="text-gray-400">No assets registered by this wallet.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {registeredAssets.map((a, idx) => (
                    <div key={idx} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-gray-400 break-all">Metadata: {a.metadataURI}</p>
                      <p className="text-sm text-gray-400 break-all">NFT: {a.nftContract} #{a.tokenId.toString()}</p>
                      <p className="text-sm text-gray-400">Royalty: {(Number(a.defaultRoyaltyBPS) / 100).toFixed(2)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Fractional Tokens Held</h2>
              {fractionalHoldings.length === 0 ? (
                <p className="text-gray-400">No fractional token balance.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fractionalHoldings.map((p) => (
                    <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold">Pool #{p.id}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${p.active ? "bg-green-900/40 text-green-400" : "bg-gray-800 text-gray-400"}`}>
                          {p.active ? "Active" : "Closed"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 break-all">FT: {p.ftAddress}</p>
                      <p className="text-sm text-gray-400 break-all">NFT: {p.nftContract} #{p.tokenId.toString()}</p>
                      <p className="text-sm text-gray-400">Balance: {formatUnits(p.balance, 18)} tokens</p>
                      <p className="text-sm text-gray-400">Sold: {formatUnits(p.sold, 18)} / {formatUnits(p.totalFractions, 18)}</p>
                      <button
                        onClick={() => handleClaim(p.id)}
                        disabled={claimConfirming}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition text-sm"
                      >
                        {claimConfirming ? "Claiming..." : "Claim Royalties"}
                      </button>
                      {claimSuccess && <p className="text-xs text-green-400">Claim sent: {claimHash}</p>}
                      {claimError && <p className="text-xs text-red-400 break-all">Error: {claimError.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
