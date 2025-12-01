"use client";

import { useOrders, useOrderStats, useMatchOrder, useMatchPreview } from "@/hooks/useOrderBook";
import { useState } from "react";
import { formatEther } from "viem";

interface OrderBookProps {
  poolId: string;
  ftAddress: string;
}

export function OrderBook({ poolId, ftAddress }: OrderBookProps) {
  const { data: stats } = useOrderStats({ poolId, ftAddress });
  const { data: ordersData } = useOrders({ poolId });
  const matchOrder = useMatchOrder();

  const [selectedBuyId, setSelectedBuyId] = useState<string | null>(null);
  const [selectedSellId, setSelectedSellId] = useState<string | null>(null);
  const [matchAmount, setMatchAmount] = useState("");

  // Preview match
  const { data: preview } = useMatchPreview(
    selectedBuyId || undefined,
    selectedSellId || undefined,
    matchAmount || undefined,
    !!(selectedBuyId && selectedSellId && matchAmount)
  );

  const handleMatch = async () => {
    if (!selectedBuyId || !selectedSellId || !matchAmount) return;

    try {
      await matchOrder.mutateAsync({
        buyOrderId: selectedBuyId,
        sellOrderId: selectedSellId,
        matchAmount,
      });

      // Reset
      setSelectedBuyId(null);
      setSelectedSellId(null);
      setMatchAmount("");
    } catch (error) {
      console.error("Match failed:", error);
    }
  };

  const buyOrders = ordersData?.data?.filter((o: any) => o.side === "BUY") || [];
  const sellOrders = ordersData?.data?.filter((o: any) => o.side === "SELL") || [];

  const marketData = stats?.orderBook || {
    highestBid: "0",
    lowestAsk: "0",
    spread: "0",
    bidCount: 0,
    askCount: 0,
  };

  return (
    <div className="space-y-6">
      {/* Market Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Highest Bid</p>
          <p className="text-xl font-bold text-blue-600">
            {marketData.highestBid !== "0" ? formatEther(BigInt(marketData.highestBid)) : "-"}
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Lowest Ask</p>
          <p className="text-xl font-bold text-red-600">
            {marketData.lowestAsk !== "0" ? formatEther(BigInt(marketData.lowestAsk)) : "-"}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Spread</p>
          <p className="text-xl font-bold text-purple-600">
            {marketData.spread !== "0" ? formatEther(BigInt(marketData.spread)) : "-"}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="text-xl font-bold">
            {marketData.bidCount + marketData.askCount}
          </p>
        </div>
      </div>

      {/* Order Book */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buy Orders */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold mb-4 text-green-600">
            Buy Orders ({buyOrders.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Price</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {buyOrders.map((order: any) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedBuyId === order.id ? "bg-green-100" : ""
                    }`}
                    onClick={() => setSelectedBuyId(order.id)}
                  >
                    <td className="px-4 py-2 text-green-600 font-medium">
                      {formatEther(BigInt(order.pricePerToken))}
                    </td>
                    <td className="px-4 py-2">
                      {formatEther(BigInt(order.amount))}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatEther(
                        (BigInt(order.amount) * BigInt(order.pricePerToken)) / BigInt(1e18)
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {selectedBuyId === order.id ? (
                        <span className="text-green-600 font-bold">✓ Selected</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {buyOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No buy orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sell Orders */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-bold mb-4 text-red-600">
            Sell Orders ({sellOrders.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Price</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sellOrders.map((order: any) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedSellId === order.id ? "bg-red-100" : ""
                    }`}
                    onClick={() => setSelectedSellId(order.id)}
                  >
                    <td className="px-4 py-2 text-red-600 font-medium">
                      {formatEther(BigInt(order.pricePerToken))}
                    </td>
                    <td className="px-4 py-2">
                      {formatEther(BigInt(order.amount))}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatEther(
                        (BigInt(order.amount) * BigInt(order.pricePerToken)) / BigInt(1e18)
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {selectedSellId === order.id ? (
                        <span className="text-red-600 font-bold">✓ Selected</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {sellOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No sell orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Match Preview & Execution */}
      {selectedBuyId && selectedSellId && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Match Orders</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Match Amount (ETH)
              </label>
              <input
                type="number"
                step="0.000001"
                value={matchAmount}
                onChange={(e) => setMatchAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Preview */}
          {preview?.valid && preview?.preview && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-3 text-blue-900">Match Preview</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Matched Price</p>
                  <p className="font-bold text-lg text-blue-600">
                    {formatEther(BigInt(preview.preview.matchedPrice))} ETH
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Gas Fee (0.1%)</p>
                  <p className="font-bold text-lg text-orange-600">
                    {formatEther(BigInt(preview.preview.gasFeeAmount))} ETH
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Total Cost</p>
                  <p className="font-bold text-lg">
                    {formatEther(BigInt(preview.preview.totalCost))} ETH
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Buyer Saves</p>
                  <p className="font-bold text-lg text-green-600">
                    {formatEther(BigInt(preview.preview.buyerSaves))} ETH
                  </p>
                </div>
              </div>
            </div>
          )}

          {preview?.valid === false && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 font-medium">Invalid Match</p>
              {preview?.errors?.map((error: string, i: number) => (
                <p key={i} className="text-red-600 text-sm">
                  • {error}
                </p>
              ))}
            </div>
          )}

          {/* Match Button */}
          <button
            onClick={handleMatch}
            disabled={
              matchOrder.isPending ||
              !preview?.valid ||
              !matchAmount
            }
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              matchOrder.isPending ||
              !preview?.valid ||
              !matchAmount
                ? "bg-gray-400 cursor-not-allowed text-gray-600"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {matchOrder.isPending ? "Matching..." : "Execute Match"}
          </button>

          {matchOrder.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
              <p className="text-green-700 font-medium">Orders matched successfully!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
