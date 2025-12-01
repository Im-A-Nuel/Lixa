"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Address } from "viem";

export interface OrderData {
  id: string;
  orderId: string;
  userAddress: string;
  side: "BUY" | "SELL";
  poolId: string;
  ftAddress: string;
  amount: string;
  pricePerToken: string;
  totalValue: string;
  filledAmount: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  signature?: string;
}

export interface CreateOrderParams {
  userAddress: string;
  side: "BUY" | "SELL";
  poolId: string;
  ftAddress: string;
  amount: string;
  pricePerToken: string;
  chainId: number;
  expiresAt: number;
  signature?: string;
  nonce?: number;
}

export interface MatchOrderParams {
  buyOrderId: string;
  sellOrderId: string;
  matchAmount: string;
}

/**
 * Hook untuk fetch orders dengan filter
 */
export function useOrders(
  filters?: {
    side?: "BUY" | "SELL";
    poolId?: string;
    userAddress?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
  enabled: boolean = true
) {
  const queryParams = new URLSearchParams();

  if (filters?.side) queryParams.append("side", filters.side);
  if (filters?.poolId) queryParams.append("poolId", filters.poolId);
  if (filters?.userAddress) queryParams.append("userAddress", filters.userAddress);
  if (filters?.status) queryParams.append("status", filters.status);
  if (filters?.limit) queryParams.append("limit", filters.limit.toString());
  if (filters?.offset) queryParams.append("offset", filters.offset.toString());

  return useQuery({
    queryKey: ["orders", filters],
    queryFn: async () => {
      const res = await fetch(`/api/orders/list?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    enabled,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
}

/**
 * Hook untuk create order
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateOrderParams) => {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create order");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/**
 * Hook untuk match orders
 */
export function useMatchOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MatchOrderParams) => {
      const res = await fetch("/api/orders/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to match orders");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

/**
 * Hook untuk preview match tanpa create
 */
export function useMatchPreview(
  buyOrderId?: string,
  sellOrderId?: string,
  matchAmount?: string,
  enabled: boolean = false
) {
  const queryParams = new URLSearchParams();

  if (buyOrderId) queryParams.append("buyOrderId", buyOrderId);
  if (sellOrderId) queryParams.append("sellOrderId", sellOrderId);
  if (matchAmount) queryParams.append("matchAmount", matchAmount);

  return useQuery({
    queryKey: ["matchPreview", buyOrderId, sellOrderId, matchAmount],
    queryFn: async () => {
      const res = await fetch(`/api/orders/match?${queryParams}`);
      if (!res.ok) throw new Error("Failed to preview match");
      return res.json();
    },
    enabled: enabled && !!buyOrderId && !!sellOrderId && !!matchAmount,
  });
}

/**
 * Hook untuk cancel order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { orderId: string; userAddress: string }) => {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel order");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/**
 * Hook untuk fetch market stats
 */
export function useOrderStats(
  filters?: {
    poolId?: string;
    ftAddress?: string;
  },
  enabled: boolean = true
) {
  const queryParams = new URLSearchParams();

  if (filters?.poolId) queryParams.append("poolId", filters.poolId);
  if (filters?.ftAddress) queryParams.append("ftAddress", filters.ftAddress);

  return useQuery({
    queryKey: ["stats", filters],
    queryFn: async () => {
      const res = await fetch(`/api/orders/stats?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
}
