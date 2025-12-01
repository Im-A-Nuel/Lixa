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
        ],
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
        ],
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
    <div className="min-h-screen bg-gray-950">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Secondary Market</h1>
          <p className="text-gray-400">Trade fractional tokens like a crypto exchange</p>
        </div>

        {/* Filter and Sort */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-8 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Search</label>
              <input
                type="text"
                placeholder="Token name or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-white"
              >
                <option value="price">Highest Price</option>
                <option value="volume">24h Volume</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="w-full">
                <p className="text-sm text-gray-400 mb-2">Total Tokens</p>
                <p className="text-2xl font-bold">{filteredTokens.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tokens Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading tokens...</div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No tokens found</h3>
            <p className="text-gray-500">No fractional tokens match your search</p>
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
                  <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-purple-500 transition cursor-pointer h-full flex flex-col">
                    {/* Token Image */}
                    <div className="aspect-square bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-4xl font-bold relative overflow-hidden">
                      {meta?.imageUrl ? (
                        <img src={meta.imageUrl} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{displaySymbol?.charAt(0) || "T"}</span>
                      )}
                      {pool.active && (
                        <div className="absolute top-2 right-2 bg-green-600 px-2 py-1 rounded text-xs font-semibold">
                          Active
                        </div>
                      )}
                    </div>

                    {/* Token Info */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                      <div>
                        <h3 className="font-semibold text-lg">{displayName}</h3>
                        <p className="text-sm text-gray-400">{displaySymbol}</p>
                      </div>

                      {/* Price Info */}
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Price</p>
                          <p className="text-2xl font-bold">{stats?.currentPrice || "0.00"} ETH</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-800 rounded p-2">
                            <p className="text-xs text-gray-500">24h Change</p>
                            <p className={`font-semibold ${isPriceUp ? "text-green-400" : "text-red-400"}`}>
                              {isPriceUp ? "+" : ""}{priceChange.toFixed(2)}%
                            </p>
                          </div>
                          <div className="bg-gray-800 rounded p-2">
                            <p className="text-xs text-gray-500">Trades</p>
                            <p className="font-semibold">{stats?.totalMatches || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Supply Info */}
                      <div className="text-xs text-gray-500 space-y-1 mt-auto">
                        <div className="flex justify-between">
                          <span>Supply:</span>
                          <span className="text-gray-300">{formatUnits(pool.totalFractions, 18).slice(0, 8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>For Sale (orders):</span>
                          <span className="text-gray-300">
                            {stats?.forSaleOrders ? formatAmountShort(stats.forSaleOrders) : "0"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Trades Done:</span>
                          <span className="text-gray-300">
                            {tradesHistory[pool.ftAddress]?.length || 0}
                          </span>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button className="w-full mt-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition text-sm">
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
  );
}
