"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther, formatUnits } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import { ipfsHttpGateways } from "@/lib/ipfs";
import { MarketplaceNav } from "@/components/MarketplaceNav";
import { useReadContract as useReadContractSingle } from "wagmi";

export default function SecondaryMarketPage() {
  const { chainId, address, isConnected } = useAccount();
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;

  // Fetch all pools
  const { data: totalPools } = useReadContract({
    address: fractionalizerAddress,
    abi: FractionalizerABI,
    functionName: "totalPools",
  });

  const poolQueries = useMemo(() => {
    if (!fractionalizerAddress || !totalPools || totalPools === BigInt(0)) return [];
    return Array.from({ length: Number(totalPools) }, (_, idx) => ({
      address: fractionalizerAddress,
      abi: FractionalizerABI as any,
      functionName: "poolInfo",
      args: [BigInt(idx + 1)],
    }));
  }, [fractionalizerAddress, totalPools]);

  const { data: poolData } = useReadContracts({
    contracts: poolQueries,
    query: { enabled: poolQueries.length > 0 },
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
    }[];
  }, [poolData]);

  // Fetch fractional token metadata
  type FractionalTokenData = {
    poolId: number;
    ftAddress: string;
    ftName?: string;
    ftSymbol?: string;
    imageUrl?: string;
    description?: string;
  };

  const [tokenMetadata, setTokenMetadata] = useState<Record<string, FractionalTokenData>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price" | "volume">("price");

  useEffect(() => {
    const fetchMetadata = async () => {
      if (pools.length === 0) return;
      setLoading(true);

      const metadata: Record<string, FractionalTokenData> = {};
      for (const pool of pools) {
        try {
          const res = await fetch(`/api/token/details?ftAddress=${pool.ftAddress}&poolId=${pool.id}`);
          if (res.ok) {
            const data = await res.json();
            metadata[pool.ftAddress] = {
              poolId: pool.id,
              ftAddress: pool.ftAddress,
              ftName: data.ftName ?? undefined,
              ftSymbol: data.ftSymbol ?? undefined,
              imageUrl: data.imageUrl,
              description: data.description,
            };
          }
        } catch (err) {
          console.error(`Error fetching metadata for pool ${pool.id}:`, err);
          metadata[pool.ftAddress] = {
            poolId: pool.id,
            ftAddress: pool.ftAddress,
          };
        }
      }
      setTokenMetadata(metadata);
      setLoading(false);
    };

    fetchMetadata();
  }, [pools]);

  // On-chain ERC20 metadata per pool
  const erc20MetaQueries = useMemo(() => {
    if (pools.length === 0) return [];
    return pools.flatMap((pool) => [
      {
        address: pool.ftAddress as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "name",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "string" }],
          },
        ] as any,
        functionName: "name",
      },
      {
        address: pool.ftAddress as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "symbol",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "string" }],
          },
        ] as any,
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

  // Fetch price statistics for each token
  type PriceStats = {
    currentPrice: string;
    highPrice24h: string;
    lowPrice24h: string;
    volume24h: string;
    changePercent24h: number;
    totalMatches: number;
    forSaleOrders?: string;
  };

  const [priceStats, setPriceStats] = useState<Record<string, PriceStats>>({});

  // Fetch trades history
  type TradeHistory = {
    id: string;
    buyerAddress: string;
    sellerAddress: string;
    matchedAmount: string;
    matchedPrice: string;
    createdAt: string;
    settledAt?: string;
    txHash?: string;
  };

  const [tradesHistory, setTradesHistory] = useState<Record<string, TradeHistory[]>>({});

  useEffect(() => {
    const fetchStats = async () => {
      if (pools.length === 0) return;

      const stats: Record<string, PriceStats> = {};
      for (const pool of pools) {
        try {
          const res = await fetch(`/api/token/stats?ftAddress=${pool.ftAddress}&poolId=${pool.id}`);
          // Fetch open sell orders to show real "for sale" volume (exclude filled/cancelled)
          const ordersRes = await fetch(`/api/orders/list?ftAddress=${pool.ftAddress}`);
          if (res.ok) {
            const data = await res.json();
            const ordersJson = ordersRes.ok ? await ordersRes.json() : { data: [] };
            const openSellVolume = (ordersJson.data || [])
              .filter((o: any) => o.side === "SELL" && ["OPEN", "PARTIALLY_FILLED"].includes(o.status))
              .reduce((acc: bigint, o: any) => {
                const remaining = BigInt(o.amount) - BigInt(o.filledAmount || "0");
                return acc + (remaining > BigInt(0) ? remaining : BigInt(0));
              }, BigInt(0));
            stats[pool.ftAddress] = {
              currentPrice: data.lastPrice || formatEther(pool.salePricePerToken),
              highPrice24h: data.highPrice || "0",
              lowPrice24h: data.lowPrice || "0",
              volume24h: data.dailyVolume || "0",
              changePercent24h: data.changePercent || 0,
              totalMatches: data.totalMatches || 0,
              forSaleOrders: formatUnits(openSellVolume, 18),
            };
          } else {
            stats[pool.ftAddress] = {
              currentPrice: formatEther(pool.salePricePerToken),
              highPrice24h: formatEther(pool.salePricePerToken),
              lowPrice24h: formatEther(pool.salePricePerToken),
              volume24h: "0",
              changePercent24h: 0,
              totalMatches: 0,
            };
          }
        } catch (err) {
          console.error(`Error fetching stats for pool ${pool.id}:`, err);
          stats[pool.ftAddress] = {
            currentPrice: formatEther(pool.salePricePerToken),
            highPrice24h: formatEther(pool.salePricePerToken),
            lowPrice24h: formatEther(pool.salePricePerToken),
            volume24h: "0",
            changePercent24h: 0,
            totalMatches: 0,
          };
        }
      }
      setPriceStats(stats);
    };

    const fetchTrades = async () => {
      if (pools.length === 0) return;

      const trades: Record<string, TradeHistory[]> = {};
      for (const pool of pools) {
        try {
          const res = await fetch(`/api/token/trades?ftAddress=${pool.ftAddress}`);
          if (res.ok) {
            const data = await res.json();
            trades[pool.ftAddress] = data.trades || [];
          } else {
            trades[pool.ftAddress] = [];
          }
        } catch (err) {
          console.error(`Error fetching trades for pool ${pool.id}:`, err);
          trades[pool.ftAddress] = [];
        }
      }
      setTradesHistory(trades);
    };

    fetchStats();
    fetchTrades();

    // Auto-refresh stats and trades every 10 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchTrades();
    }, 10000);

    return () => clearInterval(interval);
  }, [pools]);

  // Filter and sort tokens
  const filteredTokens = useMemo(() => {
    let filtered = pools.filter((pool) => {
      const meta = tokenMetadata[pool.ftAddress];
      const onchainMeta = onchainMetaMap[pool.id];
      const searchLower = searchTerm.toLowerCase();
      const nameSearch = meta?.ftName || onchainMeta?.name || `Token ${pool.id}`;
      const symbolSearch = meta?.ftSymbol || onchainMeta?.symbol || `T${pool.id}`;
      return (
        nameSearch.toLowerCase().includes(searchLower) ||
        symbolSearch.toLowerCase().includes(searchLower)
      );
    });

    // Sort
    switch (sortBy) {
      case "name":
        filtered.sort((a, b) => {
          const nameA = tokenMetadata[a.ftAddress]?.ftName || onchainMetaMap[a.id]?.name || `Token ${a.id}`;
          const nameB = tokenMetadata[b.ftAddress]?.ftName || onchainMetaMap[b.id]?.name || `Token ${b.id}`;
          return nameA.localeCompare(nameB);
        });
        break;
      case "volume":
        filtered.sort((a, b) => {
          const volA = parseFloat(priceStats[a.ftAddress]?.volume24h || "0");
          const volB = parseFloat(priceStats[b.ftAddress]?.volume24h || "0");
          return volB - volA;
        });
        break;
      case "price":
      default:
        filtered.sort((a, b) => {
          const priceA = parseFloat(formatEther(a.salePricePerToken));
          const priceB = parseFloat(formatEther(b.salePricePerToken));
          return priceB - priceA;
        });
    }

    return filtered;
  }, [pools, tokenMetadata, priceStats, searchTerm, sortBy]);

  const formatAmountShort = (val?: string) => {
    const num = parseFloat(val || "0");
    if (Number.isNaN(num)) return "0";
    if (num >= 1) {
      return Number.isInteger(num)
        ? num.toLocaleString()
        : num.toFixed(4).replace(/\.?0+$/, "");
    }
    return num.toFixed(4).replace(/\.?0+$/, "");
  };

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-sm text-indigo-300 font-medium">Trading Hub</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
            Secondary Market
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Trade fractional tokens with real-time pricing and advanced order matching
          </p>
        </div>

        {/* Filter and Sort */}
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 mb-10 shadow-2xl">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="group">
              <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Tokens
              </label>
              <input
                type="text"
                placeholder="Search by name or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600 text-white"
              />
            </div>
            <div className="group">
              <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-gray-800 transition-all duration-200 group-hover:border-gray-600 text-white cursor-pointer"
              >
                <option value="price">Highest Price</option>
                <option value="volume">24h Volume</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="w-full bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-400 mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Total Tokens
                </p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">{filteredTokens.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tokens Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
              <svg className="animate-spin w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-indigo-300 font-medium">Loading tokens...</span>
            </div>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-300 mb-2">No Tokens Found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTokens.map((pool) => {
              const meta = tokenMetadata[pool.ftAddress];
              const onchainMeta = onchainMetaMap[pool.id];
              const displayName = onchainMeta?.name || meta?.ftName || `Token ${pool.id}`;
              const displaySymbol = onchainMeta?.symbol || meta?.ftSymbol || `T${pool.id}`;
              const stats = priceStats[pool.ftAddress];
              const priceChange = stats?.changePercent24h || 0;
              const isPriceUp = priceChange >= 0;

              return (
                <Link key={pool.id} href={`/secondary-market/${pool.id}`}>
                  <div className="group bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer h-full flex flex-col hover:scale-[1.02]">
                    {/* Token Image */}
                    <div className="aspect-square bg-gradient-to-br from-purple-600 via-pink-600 to-indigo-600 flex items-center justify-center text-white text-5xl font-bold relative overflow-hidden">
                      {meta?.imageUrl ? (
                        <img src={meta.imageUrl} alt={displayName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <span className="group-hover:scale-110 transition-transform duration-500">{displaySymbol?.charAt(0) || "T"}</span>
                      )}
                      {pool.active && (
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-green-500/30 flex items-center gap-1">
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                          Active
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    {/* Token Info */}
                    <div className="p-5 space-y-4 flex-1 flex flex-col">
                      <div>
                        <h3 className="font-bold text-xl text-white group-hover:text-purple-300 transition-colors">{displayName}</h3>
                        <p className="text-sm text-gray-400 font-medium">{displaySymbol}</p>
                      </div>

                      {/* Price Info */}
                      <div className="space-y-3">
                        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-3">
                          <p className="text-xs text-gray-400 mb-1 font-semibold">Current Price</p>
                          <p className="text-2xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
                            {stats?.currentPrice || "0.00"} IP
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`${isPriceUp ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"} border rounded-xl p-3`}>
                            <p className="text-xs text-gray-400 mb-1 font-semibold flex items-center gap-1">
                              {isPriceUp ? (
                                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              24h
                            </p>
                            <p className={`font-bold text-sm ${isPriceUp ? "text-green-400" : "text-red-400"}`}>
                              {isPriceUp ? "+" : ""}{priceChange.toFixed(2)}%
                            </p>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1 font-semibold">Trades</p>
                            <p className="font-bold text-sm text-blue-300">{stats?.totalMatches || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Supply Info */}
                      <div className="text-xs text-gray-500 space-y-2 mt-auto bg-gray-800/40 rounded-xl p-3 border border-gray-700/30">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Supply:</span>
                          <span className="text-gray-300 font-semibold">{formatUnits(pool.totalFractions, 18).slice(0, 8)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">For Sale:</span>
                          <span className="text-gray-300 font-semibold">
                            {stats?.forSaleOrders ? formatAmountShort(stats.forSaleOrders) : "0"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Completed:</span>
                          <span className="text-gray-300 font-semibold">
                            {tradesHistory[pool.ftAddress]?.length || 0}
                          </span>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:via-purple-400 hover:to-indigo-500 rounded-xl font-bold transition-all duration-300 text-sm shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Trade Now
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
