"use client";

import { useState } from "react";
import { OrderForm } from "@/components/OrderForm";
import { OrderBook } from "@/components/OrderBook";
import { useOrders, useOrderStats } from "@/hooks/useOrderBook";
import { formatEther } from "viem";

/**
 * Example page yang menampilkan semua fitur order book system
 * Navigasi ke /examples untuk melihat
 */
export default function OrderBookExamplePage() {
  const [activeTab, setActiveTab] = useState<"create" | "book" | "stats">("create");

  // Example values (ganti dengan nilai real)
  const POOL_ID = "1";
  const FT_ADDRESS = "0x0987654321098765432109876543210987654321";
  const CHAIN_ID = 11155111; // Sepolia

  const { data: stats } = useOrderStats({ poolId: POOL_ID, ftAddress: FT_ADDRESS });

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Order Book System Demo
          </h1>
          <p className="text-gray-600">
            Off-chain buy/sell orders dengan 0.1% gas fee hanya saat transaksi terjadi
          </p>
        </div>

        {/* Config Info */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Pool ID</p>
              <p className="font-mono font-bold">{POOL_ID}</p>
            </div>
            <div>
              <p className="text-gray-600">FT Address</p>
              <p className="font-mono font-bold text-xs break-all">{FT_ADDRESS}</p>
            </div>
            <div>
              <p className="text-gray-600">Chain ID</p>
              <p className="font-mono font-bold">{CHAIN_ID} (Sepolia)</p>
            </div>
            <div>
              <p className="text-gray-600">Gas Fee</p>
              <p className="font-bold text-orange-600">0.1%</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "create"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Create Order
          </button>
          <button
            onClick={() => setActiveTab("book")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "book"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Order Book
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "stats"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Statistics
          </button>
        </div>

        {/* Content */}
        <div>
          {/* Create Order Tab */}
          {activeTab === "create" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Cara Membuat Order</h2>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Connect wallet Anda</li>
                  <li>Pilih BUY atau SELL</li>
                  <li>Masukkan amount & price</li>
                  <li>Tentukan expiry time</li>
                  <li>Klik "Create Order"</li>
                  <li>Transaksi done! (No gas fee)</li>
                </ol>
              </div>

              <OrderForm
                poolId={POOL_ID}
                ftAddress={FT_ADDRESS}
                chainId={CHAIN_ID}
              />
            </div>
          )}

          {/* Order Book Tab */}
          {activeTab === "book" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Cara Match Orders</h2>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Lihat buy orders di sebelah kiri</li>
                  <li>Lihat sell orders di sebelah kanan</li>
                  <li>Klik buy order untuk select</li>
                  <li>Klik sell order untuk select</li>
                  <li>Masukkan match amount</li>
                  <li>Preview akan show gas fee & total</li>
                  <li>Klik "Execute Match"</li>
                </ol>
              </div>

              <OrderBook poolId={POOL_ID} ftAddress={FT_ADDRESS} />
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === "stats" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-6">Market Statistics</h2>

                {stats ? (
                  <div className="space-y-6">
                    {/* Order Book Stats */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-gray-800">
                        Order Book
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Bid Count</p>
                          <p className="text-2xl font-bold text-green-600">
                            {stats.orderBook.bidCount}
                          </p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Ask Count</p>
                          <p className="text-2xl font-bold text-red-600">
                            {stats.orderBook.askCount}
                          </p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Highest Bid</p>
                          <p className="text-lg font-bold text-blue-600">
                            {stats.orderBook.highestBid !== "0"
                              ? formatEther(BigInt(stats.orderBook.highestBid))
                              : "-"}
                          </p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Lowest Ask</p>
                          <p className="text-lg font-bold text-red-600">
                            {stats.orderBook.lowestAsk !== "0"
                              ? formatEther(BigInt(stats.orderBook.lowestAsk))
                              : "-"}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Spread</p>
                          <p className="text-lg font-bold text-purple-600">
                            {stats.orderBook.spread !== "0"
                              ? formatEther(BigInt(stats.orderBook.spread))
                              : "-"}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Bid Volume</p>
                          <p className="text-lg font-bold">
                            {formatEther(BigInt(stats.orderBook.bidVolume))}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">Ask Volume</p>
                          <p className="text-lg font-bold">
                            {formatEther(BigInt(stats.orderBook.askVolume))}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Trade Data */}
                    {stats.tradeData && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-gray-800">
                          Trade Data
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Last Price</p>
                            <p className="text-xl font-bold text-blue-600">
                              {stats.tradeData.lastPrice !== "0"
                                ? formatEther(BigInt(stats.tradeData.lastPrice))
                                : "-"}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Total Trades</p>
                            <p className="text-xl font-bold">
                              {stats.tradeData.totalTrades}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Traded Volume</p>
                            <p className="text-lg font-bold">
                              {formatEther(BigInt(stats.tradeData.tradedVolume))}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Avg Price</p>
                            <p className="text-lg font-bold">
                              {stats.tradeData.avgPrice !== "0"
                                ? formatEther(BigInt(stats.tradeData.avgPrice))
                                : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Loading statistics...</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-12 bg-blue-50 border-l-4 border-blue-600 p-6 rounded">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            ℹ️ Tentang Sistem
          </h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>✅ Orders disimpan di database (off-chain)</li>
            <li>✅ Tidak ada gas fee saat membuat order</li>
            <li>✅ Gas fee (0.1%) hanya charge saat order matching</li>
            <li>✅ Auto-matching dengan price compatibility check</li>
            <li>✅ Full order history & audit trail</li>
            <li>✅ Real-time market data & statistics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
