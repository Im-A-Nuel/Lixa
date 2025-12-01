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
    <div className="min-h-screen bg-gray-950">
      <MarketplaceNav />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-purple-300 uppercase tracking-wide">Exchange History</p>
            <h1 className="text-3xl font-bold">Trade History</h1>
            <p className="text-gray-400">Semua transaksi buy/sell yang sudah settle on-chain.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={fetchTrades}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-400">
            <p>Menampilkan transaksi wallet ini (buy & sell)</p>
          </div>
          <div className="text-right text-sm text-gray-400">
            <p>Total trade: {filtered.length}</p>
            {isConnected && <p className="text-green-400">Wallet: {shorten(address!)}</p>}
            {error && <p className="text-red-400">{error}</p>}
          </div>
        </div>

        {!isConnected ? (
          <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-lg font-semibold text-gray-200 mb-2">Hubungkan wallet untuk melihat riwayatmu</p>
            <p className="text-gray-500">Trade history kini hanya menampilkan transaksi wallet yang terhubung.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/secondary-market" className="px-4 py-2 bg-purple-600 rounded-lg text-white hover:bg-purple-700 transition">
                Ke Secondary Market
              </Link>
            </div>
          </div>
        ) : loading ? (
          <div className="text-center text-gray-400 py-10">Loading history...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-lg font-semibold text-gray-200 mb-2">Belum ada trade</p>
            <p className="text-gray-500">Coba refresh atau lakukan settlement di Secondary Market.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/secondary-market" className="px-4 py-2 bg-purple-600 rounded-lg text-white hover:bg-purple-700 transition">
                Ke Secondary Market
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((trade) => {
              const amount = safeFormatAmount(trade.matchedAmount);
              const price = safeFormatEth(trade.matchedPrice);
              const total = safeFormatEth(trade.totalValue);
              const settledAt = trade.settledAt || trade.createdAt;
              const side = trade.side || "TRADE";
              const sideColor =
                side === "BUY" ? "bg-green-900/40 text-green-300" : side === "SELL" ? "bg-red-900/40 text-red-300" : "bg-gray-800 text-gray-200";
              const meta = tokenMetaMap[trade.ftAddress.toLowerCase()];
              const displayName = meta?.ftName || trade.ftName || "Token";
              const displaySymbol = meta?.ftSymbol || trade.ftSymbol;

              return (
                <div key={trade.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-500">Pool #{trade.poolId}</p>
                      <h3 className="text-lg font-semibold">
                        {displayName}{" "}
                        <span className="text-gray-500 text-sm">{displaySymbol ? `(${displaySymbol})` : ""}</span>
                      </h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sideColor}`}>{side}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-800 rounded p-3">
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="font-semibold">{amount} tokens</p>
                    </div>
                    <div className="bg-gray-800 rounded p-3">
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="font-semibold">{price} ETH</p>
                    </div>
                    <div className="bg-gray-800 rounded p-3 col-span-2">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="font-semibold">{total} ETH</p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 space-y-1">
                    <p>
                      Seller: <span className="font-mono text-white">{shorten(trade.sellerAddress)}</span>
                    </p>
                    <p>
                      Buyer: <span className="font-mono text-white">{shorten(trade.buyerAddress)}</span>
                    </p>
                    <p>
                      Settled: <span className="text-gray-200">{new Date(settledAt).toLocaleString()}</span>
                    </p>
                    <p className="break-all">
                      Token: <span className="font-mono text-gray-300">{trade.ftAddress}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
