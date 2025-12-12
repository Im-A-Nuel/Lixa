"use client";

import { useAccount } from "wagmi";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther, formatUnits } from "viem";
import { MarketplaceNav } from "@/components/MarketplaceNav";

type TradeEntry = {
  id: string;
  poolId: string;
  ftAddress: string;
  ftSymbol?: string;
  ftName?: string;
  buyerAddress: string;
  sellerAddress: string;
  matchedAmount: string;
  matchedPrice: string;
  totalValue: string;
  status: string;
  createdAt: string;
  settledAt?: string;
  side?: "BUY" | "SELL" | null;
};

const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
const safeFormatAmount = (wei: string) => {
  try {
    return formatUnits(BigInt(wei), 18);
  } catch {
    return "0";
  }
};
const safeFormatEth = (wei: string) => {
  try {
    return formatEther(BigInt(wei));
  } catch {
    return "0";
  }
};

export default function TradeHistoryPage() {
  const { address, isConnected } = useAccount();
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenMetaMap, setTokenMetaMap] = useState<Record<string, { ftSymbol?: string; ftName?: string }>>({});

  const fetchTrades = useCallback(async () => {
    if (!address) {
      setTrades([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200", userAddress: address });
      const res = await fetch(`/api/trades/history?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load trade history");
      }
      setTrades(json.trades || []);
    } catch (err) {
      setError((err as Error).message);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  useEffect(() => {
    const fetchSymbols = async () => {
      if (trades.length === 0) {
        setTokenMetaMap({});
        return;
      }

      const addrs = Array.from(new Set(trades.map((t) => t.ftAddress.toLowerCase())));
      const next: Record<string, { ftSymbol?: string; ftName?: string }> = {};

      await Promise.all(
        addrs.map(async (addr) => {
          try {
            const res = await fetch(`/api/token/details?ftAddress=${addr}`);
            if (!res.ok) return;
            const data = await res.json();
            next[addr] = { ftSymbol: data.ftSymbol ?? undefined, ftName: data.ftName ?? undefined };
          } catch {
            // ignore
          }
        })
      );

      setTokenMetaMap(next);
    };

    fetchSymbols();
  }, [trades]);

  const filtered = useMemo(() => trades, [trades]);

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
              Trade History
            </h1>
            <p className="text-gray-400">All buy/sell transactions settled on-chain</p>
          </div>
          <div className="flex gap-3 items-center">
            {isConnected && (
              <div className="px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg">
                <p className="text-xs text-gray-400">Connected Wallet</p>
                <p className="text-sm font-semibold text-purple-400">{shorten(address!)}</p>
              </div>
            )}
            <button
              onClick={fetchTrades}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Card */}
        {isConnected && (
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/50 border border-gray-800/50 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Trades</p>
                  <p className="text-2xl font-bold text-white">{filtered.length}</p>
                </div>
              </div>
              {error && (
                <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isConnected ? (
          <div className="text-center py-20 bg-gradient-to-br from-gray-900/80 to-gray-900/50 border border-gray-800/50 rounded-xl backdrop-blur-sm">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">Connect your wallet to view your trade history and track all your transactions</p>
            <Link
              href="/secondary-market"
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-semibold transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
            >
              Go to Secondary Market
            </Link>
          </div>
        ) : loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Loading trade history...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-gradient-to-br from-gray-900/80 to-gray-900/50 border border-gray-800/50 rounded-xl backdrop-blur-sm">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No Trades Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">Start trading on the secondary market to see your transaction history here</p>
            <Link
              href="/secondary-market"
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-semibold transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
            >
              Go to Secondary Market
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {filtered.map((trade) => {
              const amount = safeFormatAmount(trade.matchedAmount);
              const price = safeFormatEth(trade.matchedPrice);
              const total = safeFormatEth(trade.totalValue);
              const settledAt = trade.settledAt || trade.createdAt;
              const side = trade.side || "TRADE";
              const sideColor =
                side === "BUY"
                  ? "bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-500/30 text-green-400"
                  : side === "SELL"
                  ? "bg-gradient-to-r from-red-600/20 to-pink-600/20 border-red-500/30 text-red-400"
                  : "bg-gradient-to-r from-gray-700/20 to-gray-600/20 border-gray-500/30 text-gray-300";
              const meta = tokenMetaMap[trade.ftAddress.toLowerCase()];
              const displayName = meta?.ftName || trade.ftName || "Token";
              const displaySymbol = meta?.ftSymbol || trade.ftSymbol;

              return (
                <div
                  key={trade.id}
                  className="bg-gradient-to-br from-gray-900/80 to-gray-900/50 border border-gray-800/50 rounded-xl p-6 space-y-4 backdrop-blur-sm hover:border-gray-700/50 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 font-medium">Pool #{trade.poolId}</span>
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${sideColor}`}>
                          {side}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        {displayName}
                      </h3>
                      {displaySymbol && (
                        <p className="text-sm text-gray-400">{displaySymbol}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Amount</p>
                      <p className="text-sm font-bold text-white">{amount}</p>
                      <p className="text-xs text-gray-500">tokens</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Price</p>
                      <p className="text-sm font-bold text-purple-400">{price}</p>
                      <p className="text-xs text-gray-500">IP</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Total</p>
                      <p className="text-sm font-bold text-pink-400">{total}</p>
                      <p className="text-xs text-gray-500">IP</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="pt-3 border-t border-gray-800/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Seller</span>
                      <span className="font-mono text-gray-200">{shorten(trade.sellerAddress)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Buyer</span>
                      <span className="font-mono text-gray-200">{shorten(trade.buyerAddress)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Settled</span>
                      <span className="text-gray-300">{new Date(settledAt).toLocaleDateString()} {new Date(settledAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
