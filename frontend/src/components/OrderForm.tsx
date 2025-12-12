"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useCreateOrder } from "@/hooks/useOrderBook";

type OrderSide = "BUY" | "SELL";

interface OrderFormProps {
  poolId: string;
  ftAddress: string;
  chainId: number;
  onSuccess?: () => void;
}

export function OrderForm({
  poolId,
  ftAddress,
  chainId,
  onSuccess,
}: OrderFormProps) {
  const { address } = useAccount();
  const createOrder = useCreateOrder();

  const [side, setSide] = useState<OrderSide>("BUY");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    if (!amount || !price) {
      setError("Please enter amount and price");
      return;
    }

    try {
      // Convert to Wei (18 decimals)
      const amountWei = parseEther(amount).toString();
      const priceWei = parseEther(price).toString();

      // Calculate expiry
      const expiresAt = Math.floor(
        Date.now() / 1000 + parseInt(expiryDays) * 24 * 60 * 60
      );

      await createOrder.mutateAsync({
        userAddress: address,
        side,
        poolId,
        ftAddress,
        amount: amountWei,
        pricePerToken: priceWei,
        chainId,
        expiresAt,
      });

      // Reset form
      setAmount("");
      setPrice("");
      setExpiryDays("7");

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    }
  };

  // Calculate totals
  const totalValue =
    amount && price ? (parseFloat(amount) * parseFloat(price)).toFixed(4) : "0";
  const gasFee = parseFloat(totalValue) * 0.001; // 0.1% gas fee

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">
        {side === "BUY" ? "Buy" : "Sell"} Order
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Side Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="BUY"
                checked={side === "BUY"}
                onChange={(e) => setSide(e.target.value as OrderSide)}
                disabled={createOrder.isPending}
                className="mr-2"
              />
              <span className="text-green-600 font-medium">Buy</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="SELL"
                checked={side === "SELL"}
                onChange={(e) => setSide(e.target.value as OrderSide)}
                disabled={createOrder.isPending}
                className="mr-2"
              />
              <span className="text-red-600 font-medium">Sell</span>
            </label>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>
          <input
            type="number"
            step="0.000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={createOrder.isPending}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Price Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price per Token (IP)
          </label>
          <input
            type="number"
            step="0.000001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={createOrder.isPending}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Total Value & Gas Fee */}
        <div className="bg-gray-50 p-3 rounded-md">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Total Value:</span>
            <span className="font-medium">{totalValue} IP</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Gas Fee (0.1%):</span>
            <span>{gasFee.toFixed(6)} IP</span>
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry (Days)
          </label>
          <select
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            disabled={createOrder.isPending}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="1">1 Day</option>
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
          </select>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Status Messages */}
        {createOrder.isPending && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-700">Creating order...</p>
          </div>
        )}

        {createOrder.isSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-700">Order created successfully!</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={createOrder.isPending || !address}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            side === "BUY"
              ? "bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
              : "bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400"
          } disabled:cursor-not-allowed`}
        >
          {createOrder.isPending ? "Creating..." : `Create ${side} Order`}
        </button>

        {!address && (
          <p className="text-sm text-gray-600 text-center">
            Please connect your wallet to place an order
          </p>
        )}
      </form>
    </div>
  );
}
