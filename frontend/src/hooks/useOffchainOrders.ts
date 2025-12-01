"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { Address, Hash, zeroAddress } from "viem";
import {
  OffchainOrder,
  BidOrder,
  AskOrder,
  OrderStatus,
  createOrderSignaturePayload,
  validateOrder,
  isOrderExpired,
  getRemainingAmount,
} from "@/lib/orders";

export interface UseOffchainOrdersReturn {
  // Data
  orders: OffchainOrder[];
  bidOrders: BidOrder[];
  askOrders: AskOrder[];

  // Actions
  createBidOrder: (params: CreateOrderParams) => Promise<BidOrder>;
  createAskOrder: (params: CreateOrderParams) => Promise<AskOrder>;
  cancelOrder: (orderId: string) => Promise<void>;

  // State
  loading: boolean;
  error: string | null;
  success: string | null;
}

export interface CreateOrderParams {
  poolId: bigint;
  ftAddress: Address;
  amount: bigint;
  pricePerToken: bigint;
  expiresAtTimestamp?: number; // Default 7 days dari sekarang
  nonce?: number;
}

export function useOffchainOrders(): UseOffchainOrdersReturn {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [orders, setOrders] = useState<OffchainOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch user's orders dari backend
  useEffect(() => {
    if (!address || !chainId) return;

    fetchUserOrders();
  }, [address, chainId]);

  const fetchUserOrders = useCallback(async () => {
    try {
      if (!address) return;

      const res = await fetch(`/api/orders?userAddress=${address}&chainId=${chainId}`);
      if (!res.ok) throw new Error("Failed to fetch orders");

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("[Orders] Fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
    }
  }, [address, chainId]);

  const createBidOrder = useCallback(
    async (params: CreateOrderParams): Promise<BidOrder> => {
      if (!address || !chainId) throw new Error("Not connected");

      setLoading(true);
      setError(null);

      try {
        const expiresAt = params.expiresAtTimestamp || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const nonce = params.nonce ?? Math.floor(Math.random() * 1000000);
        const orderId = `${address}-${chainId}-${Date.now()}-${nonce}`;

        const order: BidOrder = {
          orderId,
          chainId,
          userAddress: address,
          side: "BID",
          poolId: params.poolId,
          ftAddress: params.ftAddress,
          amount: params.amount,
          pricePerToken: params.pricePerToken,
          createdAt: Math.floor(Date.now() / 1000),
          expiresAt,
          status: "OPEN",
          filledAmount: 0n,
          nonce,
        };

        // Validate
        const validation = validateOrder(order);
        if (!validation.valid) throw new Error(validation.errors.join(", "));

        // Sign order dengan EIP-712
        const payload = createOrderSignaturePayload(order);
        const signature = await signTypedDataAsync(payload);

        order.signature = signature;

        // Submit ke backend
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create order");
        }

        const createdOrder = await res.json();
        setOrders((prev) => [...prev, createdOrder]);
        setSuccess("Bid order created successfully");

        return createdOrder;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create bid";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, chainId, signTypedDataAsync]
  );

  const createAskOrder = useCallback(
    async (params: CreateOrderParams): Promise<AskOrder> => {
      if (!address || !chainId) throw new Error("Not connected");

      setLoading(true);
      setError(null);

      try {
        const expiresAt = params.expiresAtTimestamp || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const nonce = params.nonce ?? Math.floor(Math.random() * 1000000);
        const orderId = `${address}-${chainId}-${Date.now()}-${nonce}`;

        const order: AskOrder = {
          orderId,
          chainId,
          userAddress: address,
          side: "ASK",
          poolId: params.poolId,
          ftAddress: params.ftAddress,
          amount: params.amount,
          pricePerToken: params.pricePerToken,
          createdAt: Math.floor(Date.now() / 1000),
          expiresAt,
          status: "OPEN",
          filledAmount: 0n,
          nonce,
        };

        // Validate
        const validation = validateOrder(order);
        if (!validation.valid) throw new Error(validation.errors.join(", "));

        // Sign order dengan EIP-712
        const payload = createOrderSignaturePayload(order);
        const signature = await signTypedDataAsync(payload);

        order.signature = signature;

        // Submit ke backend
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create order");
        }

        const createdOrder = await res.json();
        setOrders((prev) => [...prev, createdOrder]);
        setSuccess("Ask order created successfully");

        return createdOrder;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create ask";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, chainId, signTypedDataAsync]
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to cancel order");
        }

        setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
        setSuccess("Order cancelled");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to cancel order";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    orders,
    bidOrders: orders.filter((o) => o.side === "BID") as BidOrder[],
    askOrders: orders.filter((o) => o.side === "ASK") as AskOrder[],
    createBidOrder,
    createAskOrder,
    cancelOrder,
    loading,
    error,
    success,
  };
}
