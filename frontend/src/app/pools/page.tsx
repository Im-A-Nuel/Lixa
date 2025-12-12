"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, formatUnits, parseUnits } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import { MarketplaceNav } from "@/components/MarketplaceNav";
import { AssetMedia } from "@/components/AssetMedia";

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
];

type TokenMeta = {
  ftName?: string;
  ftSymbol?: string;
  imageUrl?: string;
  description?: string;
};

export default function PoolsPage() {
  const { chainId, isConnected, address } = useAccount();
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");
  const [amountInputs, setAmountInputs] = useState<Record<number, string>>({});
  const [tokenMetadata, setTokenMetadata] = useState<Record<number, TokenMeta>>({});

  const { data: totalPools } = useReadContract({
    address: fractionalizerAddress,
    abi: FractionalizerABI,
    functionName: "totalPools",
  });

  const poolQueries = useMemo(() => {
    if (!fractionalizerAddress || !totalPools || totalPools === 0n) return [];
    const count = Number(totalPools);
    return Array.from({ length: count }, (_, idx) => ({
      address: fractionalizerAddress,
      abi: FractionalizerABI as any,
      functionName: "poolInfo",
      args: [BigInt(idx + 1)],
    }));
  }, [fractionalizerAddress, totalPools]);

  const { data: poolData, isLoading } = useReadContracts({
    contracts: poolQueries,
    query: { enabled: poolQueries.length > 0 },
  });

  // Read allowances for each pool (originalOwner -> fractionalizer)
  const allowanceQueries = useMemo(() => {
    if (!fractionalizerAddress || !poolData) return [];
    return poolData.map((entry) => {
      if (!entry || entry.status !== "success") return null;
      const [, , ftAddress, , originalOwner] = entry.result as any;
      return {
        address: ftAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [originalOwner, fractionalizerAddress],
      };
    }).filter(Boolean) as any[];
  }, [fractionalizerAddress, poolData]);

  const { data: allowanceData } = useReadContracts({
    contracts: allowanceQueries,
    query: { enabled: allowanceQueries.length > 0 },
  });

  const pools = useMemo(() => {
    if (!poolData) return [];
    return poolData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        const [nftContract, tokenId, ftAddress, totalFractions, originalOwner, salePricePerToken, amountForSale, sold, active] =
          entry.result as any;
        return {
          id: idx + 1,
          nftContract,
          tokenId,
          ftAddress,
          totalFractions,
          originalOwner,
          salePricePerToken,
          amountForSale,
          sold,
          active,
          allowance: allowanceData && allowanceData[idx] && allowanceData[idx].status === "success" ? (allowanceData[idx].result as bigint) : 0n,
        };
      })
      .filter(Boolean) as {
      id: number;
      nftContract: string;
      tokenId: bigint;
      ftAddress: string;
      totalFractions: bigint;
      originalOwner: string;
      salePricePerToken: bigint;
      amountForSale: bigint;
      sold: bigint;
      active: boolean;
      allowance: bigint;
    }[];
  }, [poolData, allowanceData]);

  useEffect(() => {
    const fetchMeta = async () => {
      if (pools.length === 0) {
        setTokenMetadata({});
        return;
      }

      const next: Record<number, TokenMeta> = {};
      for (const pool of pools) {
        try {
          const res = await fetch(`/api/token/details?ftAddress=${pool.ftAddress}&poolId=${pool.id}`);
          if (res.ok) {
            const data = await res.json();
            next[pool.id] = {
              ftName: data.ftName ?? undefined,
              ftSymbol: data.ftSymbol ?? undefined,
              imageUrl: data.imageUrl,
              description: data.description,
            };
          } else {
            next[pool.id] = {};
          }
        } catch {
          next[pool.id] = {};
        }
      }
      setTokenMetadata(next);
    };

    fetchMeta();
  }, [pools]);

  const erc20MetaQueries = useMemo(() => {
    if (!pools || pools.length === 0) return [];
    return pools.flatMap((pool) => [
      {
        address: pool.ftAddress as `0x${string}`,
        abi: ERC20_ABI as any,
        functionName: "name",
      },
      {
        address: pool.ftAddress as `0x${string}`,
        abi: ERC20_ABI as any,
        functionName: "symbol",
      },
    ]);
  }, [pools]);

  const { data: erc20MetaData } = useReadContracts({
    contracts: erc20MetaQueries,
    query: { enabled: erc20MetaQueries.length > 0 },
  });

  const onchainMetaMap = useMemo(() => {
    if (!erc20MetaData || pools.length === 0) return {};
    const map: Record<number, { name?: string; symbol?: string }> = {};
    for (let i = 0; i < erc20MetaData.length; i += 2) {
      const poolIndex = Math.floor(i / 2);
      const nameEntry = erc20MetaData[i];
      const symbolEntry = erc20MetaData[i + 1];
      const pool = pools[poolIndex];
      if (!pool) continue;
      map[pool.id] = {
        name: nameEntry && nameEntry.status === "success" ? (nameEntry.result as string) : undefined,
        symbol: symbolEntry && symbolEntry.status === "success" ? (symbolEntry.result as string) : undefined,
      };
    }
    return map;
  }, [erc20MetaData, pools]);

  const filteredPools = useMemo(() => {
    let filtered = pools;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((pool) => {
        const meta = tokenMetadata[pool.id];
        const onchainMeta = onchainMetaMap[pool.id];
        return (
          pool.id.toString().includes(query) ||
          pool.ftAddress.toLowerCase().includes(query) ||
          pool.originalOwner.toLowerCase().includes(query) ||
          meta?.ftName?.toLowerCase().includes(query) ||
          meta?.ftSymbol?.toLowerCase().includes(query) ||
          onchainMeta?.name?.toLowerCase().includes(query) ||
          onchainMeta?.symbol?.toLowerCase().includes(query) ||
          formatEther(pool.salePricePerToken).includes(query)
        );
      });
    }

    // Apply sorting
    const sorted = [...filtered];
    if (sortBy === "highest") {
      sorted.sort((a, b) => Number(b.salePricePerToken - a.salePricePerToken));
    } else if (sortBy === "lowest") {
      sorted.sort((a, b) => Number(a.salePricePerToken - b.salePricePerToken));
    } else {
      sorted.sort((a, b) => b.id - a.id); // newest first
    }

    return sorted;
  }, [pools, searchQuery, tokenMetadata, onchainMetaMap, sortBy]);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const {
    writeContract: writeApproveSale,
    data: approveHash,
    isPending: approvePending,
    error: approveError,
  } = useWriteContract();
  const { isLoading: approveConfirming } = useWaitForTransactionReceipt({ hash: approveHash });

  const handleBuy = (poolId: number, salePrice: bigint) => {
    const raw = amountInputs[poolId] || "0";
    // User enters whole tokens; convert to 18-decimal smallest units
    const amountWei = parseUnits(raw, 18);
    if (amountWei === 0n) return;
    // contract expects msg.value = (salePricePerToken * amountWei) / 1e18 (price per whole token)
    const cost = (salePrice * amountWei) / 10n ** 18n;
    writeContract({
      address: fractionalizerAddress!,
      abi: FractionalizerABI,
      functionName: "buyFractions",
      args: [BigInt(poolId), amountWei],
      value: cost,
    });
  };

  const handleApproveSale = (pool: (typeof pools)[number]) => {
    writeApproveSale({
      address: pool.ftAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [fractionalizerAddress!, pool.amountForSale],
    });
  };

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Primary Market</h1>
            <p className="text-gray-400">Buy fractional tokens directly from the original owner.</p>
          </div>
          {!isConnected && <ConnectButton />}
        </div>

        {/* Search and Filter Bar */}
        {pools.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            {/* Search Input */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Tokens
              </label>
              <input
                type="text"
                placeholder="Search by name or symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-900/80 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm placeholder-gray-500"
              />
            </div>

            {/* Sort By Dropdown */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-gray-900/80 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="highest">Highest Price</option>
                <option value="lowest">Lowest Price</option>
              </select>
            </div>

            {/* Total Tokens Card */}
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Total Tokens
              </div>
              <div className="text-3xl font-bold text-white">{filteredPools.length}</div>
            </div>
          </div>
        )}

{!fractionalizerAddress ? (
          <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 rounded-2xl p-6 text-yellow-400 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Please switch to a supported network (anvil 31337 or the chain you deployed to).</span>
            </div>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20">
            <div className="inline-block w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 text-lg">Loading pools...</p>
          </div>
        ) : filteredPools.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-300 mb-2">
              {searchQuery ? "No Pools Found" : "No Pools Yet"}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? "No pools match your search criteria. Try different keywords."
                : "Start by fractionalizing your first asset to create a pool."}
            </p>
          </div>
        ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPools.map((pool) => {
                  const remaining = pool.amountForSale - pool.sold;
                  const priceEth = formatEther(pool.salePricePerToken); // price per whole token
                  const meta = tokenMetadata[pool.id];
                  const onchainMeta = onchainMetaMap[pool.id];
                  const displayName = onchainMeta?.name || meta?.ftName || `Token ${pool.id}`;
                  const displaySymbol = onchainMeta?.symbol || meta?.ftSymbol || `T${pool.id}`;
                  const supply = formatUnits(pool.totalFractions, 18);
                  const soldPercentage = pool.amountForSale > 0n ? Number((pool.sold * 100n) / pool.amountForSale) : 0;

                  return (
                    <div
                      key={pool.id}
                      className="group bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/10 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300"
                    >
                      {/* Image Section */}
                      {meta?.imageUrl && (
                        <div className="aspect-video bg-gradient-to-br from-gray-950 to-gray-900 overflow-hidden relative">
                          <AssetMedia
                            src={meta.imageUrl}
                            alt={displayName}
                            interactive={false}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent"></div>

                          {/* Status Badge */}
                          <div className="absolute top-3 right-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${
                              pool.active
                                ? "bg-green-500/90 text-white"
                                : "bg-gray-500/90 text-white"
                            }`}>
                              {pool.active ? "Active" : "Closed"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Content Section */}
                      <div className="p-5 space-y-4">
                        {/* Header */}
                        <div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {displayName}
                          </h3>
                          <p className="text-sm text-gray-400 font-mono">{displaySymbol}</p>
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Supply</p>
                            <p className="text-sm font-bold text-white">{parseFloat(supply).toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Price</p>
                            <p className="text-sm font-bold text-white">{parseFloat(priceEth).toFixed(4)} IP</p>
                          </div>
                        </div>

                        {/* Sales Progress */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Sold</span>
                            <span className="font-semibold text-gray-400">{soldPercentage.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(soldPercentage, 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{parseFloat(formatUnits(pool.sold, 18)).toLocaleString()} sold</span>
                            <span>{parseFloat(formatUnits(remaining, 18)).toLocaleString()} left</span>
                          </div>
                        </div>

                        {/* Purchase Section */}
                        <div className="pt-3 border-t border-gray-800 space-y-2.5">
                          <input
                            type="text"
                            placeholder="Amount to buy"
                            value={amountInputs[pool.id] ?? "0"}
                            onChange={(e) => setAmountInputs((prev) => ({ ...prev, [pool.id]: e.target.value }))}
                            className="w-full px-3.5 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 text-white text-sm placeholder-gray-500 transition-all"
                          />
                          <button
                            onClick={() => handleBuy(pool.id, pool.salePricePerToken)}
                            disabled={!pool.active || isPending || confirming || !isConnected}
                            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-sm shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all duration-200"
                          >
                            {isPending ? "Confirming..." : confirming ? "Processing..." : "Buy Fractions"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        )}

        {error && (
          <div className="bg-gradient-to-r from-red-900/30 to-pink-900/30 border border-red-600/50 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-red-400">Transaction Failed</p>
                <p className="text-sm text-red-300/80">{error.message}</p>
              </div>
            </div>
          </div>
        )}
        {isSuccess && (
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-600/50 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-400">Purchase Successful!</p>
                <p className="text-xs text-green-300/80 font-mono break-all mt-1">TX: {txHash}</p>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
