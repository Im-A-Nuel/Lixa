"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { formatEther, formatUnits, parseUnits, parseEther } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import { useOrderExecution } from "@/hooks/useOrderExecution";
import { MarketplaceNav } from "@/components/MarketplaceNav";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
] as const;

export default function TokenDetailPage() {
  const params = useParams();
  const poolId = params?.poolId ? Number(params.poolId) : null;
  const { chainId, address, isConnected } = useAccount();
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;
  const { executeTrade, isExecuting } = useOrderExecution();

  // Fetch pool info
  const { data: poolInfo } = useReadContract({
    address: fractionalizerAddress,
    abi: FractionalizerABI,
    functionName: "poolInfo",
    args: poolId ? [BigInt(poolId)] : undefined,
    query: { enabled: Boolean(poolId && fractionalizerAddress) },
  });

  const pool = useMemo(() => {
    if (!poolInfo) return null;
    const [nftContract, tokenId, ftAddress, totalFractions, originalOwner, salePricePerToken, amountForSale, sold, active] =
      poolInfo as any;
    return {
      id: poolId,
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
  }, [poolInfo, poolId]);

  // Fetch token metadata
  const [tokenMeta, setTokenMeta] = useState<{
    ftName: string;
    ftSymbol: string;
    imageUrl?: string;
    description?: string;
  } | null>(null);

  const metaFetchedRef = useRef(false);

  useEffect(() => {
    if (!pool || metaFetchedRef.current) return;

    let isMounted = true;
    metaFetchedRef.current = true;

    const fetch = async () => {
      try {
        const res = await fetch(`/api/token/details?ftAddress=${pool.ftAddress}&poolId=${poolId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setTokenMeta({
            ftName: data.ftName ?? undefined,
            ftSymbol: data.ftSymbol ?? undefined,
            imageUrl: data.imageUrl,
            description: data.description,
          });
        } else if (isMounted) {
          // Set default on error
          setTokenMeta({
            ftName: undefined,
            ftSymbol: undefined,
          });
        }
      } catch (err) {
        // Silently fail - use default values
        if (isMounted) {
          setTokenMeta({
            ftName: undefined,
            ftSymbol: undefined,
          });
        }
      }
    };

    fetch();

    return () => {
      isMounted = false;
    };
  }, [pool?.ftAddress, poolId]);

  // Fetch orders for this token
  type OffchainOrder = {
    id: string;
    orderId: string;
    userAddress: string;
    side: "BUY" | "SELL";
    poolId: string;
    ftAddress: string;
    amount: string;
    pricePerToken: string;
    totalValue: string;
    status: string;
    filledAmount: string;
    createdAt: string;
    expiresAt: string;
  };

  const [allOrders, setAllOrders] = useState<OffchainOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!pool) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/orders/list?ftAddress=${pool.ftAddress}`);
      const json = await res.json();
      if (res.ok) {
        setAllOrders(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, [pool?.ftAddress]);

  useEffect(() => {
    let isMounted = true;

    const doFetch = async () => {
      if (isMounted) {
        await fetchOrders();
      }
    };

    doFetch();

    const interval = setInterval(() => {
      if (isMounted) {
        doFetch();
      }
    }, 5000); // Refresh every 5s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchOrders]);

  // Fetch trading activity
  type TradeActivity = {
    id: string;
    buyerAddress: string;
    sellerAddress: string;
    matchedAmount: string;
    matchedPrice: string;
    createdAt: string;
    status: string;
  };

  const [trades, setTrades] = useState<TradeActivity[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const tradesFetchedRef = useRef(false);

  useEffect(() => {
    if (!pool) {
      tradesFetchedRef.current = false;
      return;
    }

    let isMounted = true;

    const fetchTradesData = async () => {
      try {
        setTradesLoading(true);
        const res = await fetch(`/api/token/trades?ftAddress=${pool.ftAddress}&poolId=${poolId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setTrades(data.trades || []);
        }
      } catch (err) {
        // Silently fail
        if (isMounted) {
          setTrades([]);
        }
      } finally {
        if (isMounted) {
          setTradesLoading(false);
        }
      }
    };

    // Only fetch on first load
    if (!tradesFetchedRef.current) {
      tradesFetchedRef.current = true;
      fetchTradesData();
    }

    // Refresh trades every 10 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchTradesData();
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pool?.ftAddress, poolId]);

  // Pending matches for settlement (wallet only)
  type PendingMatch = {
    id: string;
    buyOrderId: string;
    sellOrderId: string;
    buyerAddress: string;
    sellerAddress: string;
    ftAddress: string;
    poolId: string;
    matchedAmount: string;
    matchedPrice: string;
    status: string;
    createdAt: string;
  };

  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [settlementMessage, setSettlementMessage] = useState<string | null>(null);
  const [settlementInProgress, setSettlementInProgress] = useState<string | null>(null);

  const fetchPendingMatches = useCallback(async () => {
    if (!pool) return;
    setMatchesLoading(true);
    try {
      const res = await fetch("/api/orders/pending-matches");
      const json = await res.json();
      if (res.ok) {
        const filtered = (json.data || []).filter((m: PendingMatch) => m.ftAddress?.toLowerCase() === pool.ftAddress.toLowerCase());
        setPendingMatches(filtered);
      }
    } catch (err) {
      console.error("Error fetching pending matches:", err);
    } finally {
      setMatchesLoading(false);
    }
  }, [pool?.ftAddress]);

  useEffect(() => {
    let isMounted = true;

    const doFetch = async () => {
      if (isMounted) {
        await fetchPendingMatches();
      }
    };

    doFetch();

    const interval = setInterval(() => {
      if (isMounted) {
        doFetch();
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchPendingMatches]);

  const handleSettleMatch = async (matchId: string) => {
    setSettlementMessage(null);
    setSettlementInProgress(matchId);
    try {
      await executeTrade(matchId);
      setSettlementMessage("✅ Settlement submitted to your wallet");
      await fetchPendingMatches();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to settle";
      setSettlementMessage(msg);
    } finally {
      setSettlementInProgress(null);
    }
  };

  // Fetch stats
  const [stats, setStats] = useState<any>(null);
  const statsFetchedRef = useRef(false);

  useEffect(() => {
    if (!pool) {
      statsFetchedRef.current = false;
      return;
    }

    let isMounted = true;

    const fetch = async () => {
      try {
        const res = await fetch(`/api/token/stats?ftAddress=${pool.ftAddress}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        // Silently fail
        if (isMounted) {
          setStats(null);
        }
      }
    };

    // Only fetch on first load
    if (!statsFetchedRef.current) {
      statsFetchedRef.current = true;
      fetch();
    }

    // Refresh stats every 30 seconds (but don't log errors)
    const interval = setInterval(() => {
      if (isMounted) {
        fetch();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pool?.ftAddress]);

  const buyOrders = useMemo(() => allOrders.filter((o) => o.side === "BUY"), [allOrders]);
  const sellOrders = useMemo(() => allOrders.filter((o) => o.side === "SELL"), [allOrders]);

  const openSellVolume = useMemo(() => {
    return sellOrders
      .filter((o) => ["OPEN", "PARTIALLY_FILLED"].includes(o.status))
      .reduce((acc, o) => {
        const remaining = BigInt(o.amount) - BigInt(o.filledAmount || "0");
        return acc + (remaining > 0n ? remaining : 0n);
      }, 0n);
  }, [sellOrders]);

  const formatAmountShort = (val?: string | bigint) => {
    const num = typeof val === "bigint" ? Number(val) : parseFloat(val || "0");
    if (Number.isNaN(num)) return "0";
    if (num >= 1) {
      return Number.isInteger(num)
        ? num.toLocaleString()
        : num.toFixed(4).replace(/\.?0+$/, "");
    }
    return num.toFixed(4).replace(/\.?0+$/, "");
  };

  // Order form state
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderAmount, setOrderAmount] = useState("1");
  const [orderPrice, setOrderPrice] = useState("0.001");
  const [expiryDays, setExpiryDays] = useState("7");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  // Initialize order price from pool
  useEffect(() => {
    if (!pool) return;
    if (orderPrice === "0.001") {
      setOrderPrice(stats?.lastPrice || formatEther(pool.salePricePerToken));
    }
  }, [pool?.salePricePerToken, stats?.lastPrice]);

  // Fetch user balance for SELL orders using wagmi hook (direct blockchain call)
  const { data: rawBalance, isLoading: loadingBalance } = useReadContract({
    address: pool?.ftAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(pool?.ftAddress && address && orderSide === "SELL") },
  });

  const { data: onchainName } = useReadContract({
    address: pool?.ftAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "name",
    query: { enabled: Boolean(pool?.ftAddress) },
  });

  const { data: onchainSymbol } = useReadContract({
    address: pool?.ftAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: Boolean(pool?.ftAddress) },
  });

  const tokenBalance = rawBalance ? formatUnits(rawBalance, 18) : "0";
  const balanceError = null; // No error needed since wagmi handles it transparently

  const handleCreateOrder = async () => {
    if (!pool || !address) {
      setOrderMessage("Connect wallet to create order");
      return;
    }

    // Validate balance loading completed for SELL orders
    if (orderSide === "SELL" && loadingBalance) {
      setOrderMessage("Checking balance...");
      return;
    }

    const amountWei = parseUnits(orderAmount || "0", 18);
    const priceWei = parseEther(orderPrice || "0");

    if (amountWei === 0n || priceWei === 0n) {
      setOrderMessage("Amount and price must be greater than 0");
      return;
    }

    if (orderSide === "SELL") {
      const userBalance = parseUnits(tokenBalance || "0", 18);
      if (amountWei > userBalance) {
        setOrderMessage(
          `Insufficient balance. You have ${tokenBalance} tokens but need ${orderAmount}`
        );
        return;
      }
    }

    setCreatingOrder(true);
    setOrderMessage(null);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(expiryDays || "7"));

      // Create AbortController with 30s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          side: orderSide,
          poolId: poolId?.toString(),
          ftAddress: pool.ftAddress,
          amount: amountWei.toString(),
          pricePerToken: priceWei.toString(),
          chainId,
          signature: null,
          nonce: 0,
          expiresAt: expiresAt.toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create order");
      }

      setOrderMessage("✅ Order created! Auto-matching...");
      setOrderAmount("1");

      // Auto-match with timeout
      try {
        const matchController = new AbortController();
        const matchTimeoutId = setTimeout(() => matchController.abort(), 15000);

        const matchRes = await fetch("/api/orders/auto-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: json.order.id }),
          signal: matchController.signal,
        });

        clearTimeout(matchTimeoutId);

        const matchJson = await matchRes.json();
        if (matchJson.success && matchJson.matchesCreated > 0) {
          setOrderMessage(`✅ Matched with ${matchJson.matchesCreated} order(s)! Ready to settle.`);
        }
      } catch (err) {
        console.error("Auto-match error:", err);
        // Don't show error, order was created successfully
      }

      await fetchOrders();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setOrderMessage(errorMsg.includes("abort") ? "Request timeout" : errorMsg);
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!address) return;
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, userAddress: address }),
      });
      if (res.ok) {
        setOrderMessage("Order cancelled");
        await fetchOrders();
      }
    } catch (err) {
      console.error("Error cancelling order:", err);
    }
  };

  const formatTokenAmount = (val: string) => {
    try {
      return formatUnits(BigInt(val || "0"), 18);
    } catch {
      return "0";
    }
  };

  const formatEthValue = (val: string) => {
    try {
      return formatEther(BigInt(val || "0"));
    } catch {
      return "0";
    }
  };

  if (!pool) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading pool data...</div>
      </div>
    );
  }

  // Show default values if tokenMeta not loaded yet
  const displayMeta = {
    ftName: tokenMeta?.ftName || (onchainName as string | undefined) || `Token ${poolId}`,
    ftSymbol: tokenMeta?.ftSymbol || (onchainSymbol as string | undefined) || `T${poolId}`,
    imageUrl: tokenMeta?.imageUrl,
    description: tokenMeta?.description,
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Token Header */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
            {displayMeta.ftSymbol?.charAt(0) || "T"}
          </div>
          <div>
            <h1 className="text-4xl font-bold">{displayMeta.ftName}</h1>
            <p className="text-gray-400 text-lg">{displayMeta.ftSymbol}</p>
            <div className="flex gap-4 mt-2">
              <div>
                <p className="text-xs text-gray-500">Trades (settled)</p>
                <p className="text-2xl font-bold">{trades.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">FT Address</p>
                <p className="text-sm font-mono text-gray-200 break-all">{pool.ftAddress}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Order Form & Book */}
          <div className="md:col-span-2 space-y-6">
            {/* Order Form */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold">Place Order</h2>

              {orderMessage && (
                <div className={`text-sm p-3 rounded ${
                  orderMessage.includes("✅")
                    ? "bg-green-900/20 border border-green-700 text-green-400"
                    : "bg-red-900/20 border border-red-700 text-red-400"
                }`}>
                  {orderMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderSide("BUY")}
                  className={`py-2 rounded font-semibold transition ${
                    orderSide === "BUY" ? "bg-green-600" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  BUY
                </button>
                <button
                  onClick={() => setOrderSide("SELL")}
                  className={`py-2 rounded font-semibold transition ${
                    orderSide === "SELL" ? "bg-red-600" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  SELL
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Amount (tokens)</label>
                <input
                  type="number"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  step="0.0001"
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Price per Token (ETH)</label>
                <input
                  type="number"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  step="0.00001"
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Expiry (days)</label>
                <input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  min="1"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Token Balance for SELL */}
              {orderSide === "SELL" && (
                <div className="bg-gray-800 rounded p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Your balance:</span>
                    {loadingBalance ? (
                      <span className="text-sm text-gray-500">Loading...</span>
                    ) : (
                      <span className="text-sm font-semibold">
                        {tokenBalance}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleCreateOrder}
                disabled={
                  creatingOrder ||
                  !isConnected ||
                  (orderSide === "SELL" && loadingBalance) ||
                  (orderSide === "SELL" && parseFloat(orderAmount) > parseFloat(tokenBalance))
                }
                className={`w-full py-3 font-bold rounded-lg transition ${
                  orderSide === "BUY"
                    ? "bg-green-600 hover:bg-green-700 disabled:bg-gray-700"
                    : "bg-red-600 hover:bg-red-700 disabled:bg-gray-700"
                }`}
              >
                {creatingOrder ? "Creating..." : loadingBalance ? "Checking Balance..." : `${orderSide} NOW`}
              </button>
            </div>

            {/* Order Book */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold">Order Book</h2>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Sell Orders */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-red-400">Sell Orders</h3>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {sellOrders.length === 0 ? (
                      <p className="text-sm text-gray-500">No sell orders</p>
                    ) : (
                      sellOrders.slice(0, 10).map((order) => (
                        <div key={order.id} className="bg-gray-800 rounded p-2 text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Amount:</span>
                            <span>{formatTokenAmount((BigInt(order.amount) - BigInt(order.filledAmount)).toString())}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Price:</span>
                            <span>{formatEthValue(order.pricePerToken)} ETH</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>by {order.userAddress.slice(0, 10)}...</span>
                            <span>{order.status}</span>
                          </div>
                          {address && address.toLowerCase() === order.userAddress.toLowerCase() && order.status !== "FILLED" && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="w-full py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Buy Orders */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-green-400">Buy Orders</h3>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {buyOrders.length === 0 ? (
                      <p className="text-sm text-gray-500">No buy orders</p>
                    ) : (
                      buyOrders.slice(0, 10).map((order) => (
                        <div key={order.id} className="bg-gray-800 rounded p-2 text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Amount:</span>
                            <span>{formatTokenAmount((BigInt(order.amount) - BigInt(order.filledAmount)).toString())}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Price:</span>
                            <span>{formatEthValue(order.pricePerToken)} ETH</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>by {order.userAddress.slice(0, 10)}...</span>
                            <span>{order.status}</span>
                          </div>
                          {address && address.toLowerCase() === order.userAddress.toLowerCase() && order.status !== "FILLED" && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="w-full py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Trading Activity & Pool Info */}
          <div className="space-y-6">
            {/* Pending Matches - settle via wallet */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Pending Settlement</h2>
                <span className="text-xs text-gray-500">wallet only</span>
              </div>

              {settlementMessage && (
                <div
                  className={`text-sm p-3 rounded ${
                    settlementMessage.includes("✅")
                      ? "bg-green-900/20 border border-green-700 text-green-400"
                      : "bg-red-900/20 border border-red-700 text-red-400"
                  }`}
                >
                  {settlementMessage}
                </div>
              )}

              {matchesLoading ? (
                <p className="text-sm text-gray-500">Loading pending matches...</p>
              ) : pendingMatches.length === 0 ? (
                <p className="text-sm text-gray-500">No pending matches for this token.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-auto">
                  {pendingMatches.map((match) => (
                    <div key={match.id} className="bg-gray-800 rounded p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount:</span>
                        <span className="font-semibold">{formatTokenAmount(match.matchedAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price:</span>
                        <span className="font-semibold">{formatEthValue(match.matchedPrice)} ETH</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Buyer {match.buyerAddress.slice(0, 6)}...</span>
                        <span>Seller {match.sellerAddress.slice(0, 6)}...</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => handleSettleMatch(match.id)}
                          disabled={Boolean(settlementInProgress) || isExecuting}
                          className="py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs font-semibold disabled:bg-gray-700"
                        >
                          {settlementInProgress === match.id && isExecuting ? "Settling..." : "Settle (Wallet)"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                Cancel tetap off-chain; settlement dilakukan langsung lewat wallet.
              </p>
            </div>

            {/* Trading Activity */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-bold">Trading Activity</h2>
              <div className="space-y-2 max-h-96 overflow-auto">
                {tradesLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : trades.length === 0 ? (
                  <p className="text-sm text-gray-500">No trades yet</p>
                ) : (
                  trades
                    .filter((t) => t.poolId === String(poolId))
                    .slice(0, 20)
                    .map((trade) => (
                    <div key={trade.id} className="bg-gray-800 rounded p-3 space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Seller</span>
                        <span className="text-gray-200 font-mono">{trade.sellerAddress.slice(0, 6)}...{trade.sellerAddress.slice(-4)}</span>
                        <span className="text-gray-500">→</span>
                        <span>Buyer</span>
                        <span className="text-gray-200 font-mono">{trade.buyerAddress.slice(0, 6)}...{trade.buyerAddress.slice(-4)}</span>
                        <span className="ml-auto px-2 py-0.5 rounded bg-gray-700 text-[10px] uppercase">{trade.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount:</span>
                        <span className="font-semibold">{formatTokenAmount(trade.matchedAmount)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(trade.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pool Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-3">
              <h2 className="text-xl font-bold">Pool Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Pool ID:</span>
                <span className="font-semibold">#{poolId}</span>
              </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Supply:</span>
                  <span className="font-semibold">{formatUnits(pool.totalFractions, 18).slice(0, 10)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">For Sale (orders):</span>
                <span className="font-semibold">
                  {formatAmountShort(formatUnits(openSellVolume, 18))}
                </span>
              </div>
              <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-semibold ${pool.active ? "text-green-400" : "text-gray-500"}`}>
                    {pool.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>FT Address:</span>
                  <span className="font-mono">{pool.ftAddress.slice(0, 8)}...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
