"use client";

import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { parseEther, parseUnits, formatEther, formatUnits } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import LicenseManagerABI from "@/lib/contracts/LicenseManager.json";
import { ipfsHttpGateways } from "@/lib/ipfs";
import { AssetMedia } from "@/components/AssetMedia";
import { useOrderExecution } from "@/hooks/useOrderExecution";
import { MarketplaceNav } from "@/components/MarketplaceNav";
import { getUserFriendlyError } from "@/lib/walletErrors";

export default function MarketplacePage() {
  const { chainId, address, isConnected } = useAccount();
  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;
  const licenseManager = chainId ? getContractAddress(chainId, "LicenseManager") : undefined;
  const { executeTrade } = useOrderExecution();

  // Assets
  const { data: totalAssets } = useReadContract({
    address: registryAddress,
    abi: AssetRegistryABI,
    functionName: "totalAssets",
  });

  const assetQueries = useMemo(() => {
    if (!registryAddress || !totalAssets || totalAssets === 0n) return [];
    return Array.from({ length: Number(totalAssets) }, (_, idx) => ({
      address: registryAddress,
      abi: AssetRegistryABI as any,
      functionName: "getAsset",
      args: [BigInt(idx + 1)],
    }));
  }, [registryAddress, totalAssets]);

  const { data: assetsData, isLoading: assetsLoading } = useReadContracts({
    contracts: assetQueries,
    query: { enabled: assetQueries.length > 0 },
  });

  const assets = useMemo(() => {
    if (!assetsData) return [];
    return assetsData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        const asset: any = entry.result;
        if (!asset?.exists) return null;
        return {
          id: idx + 1,
          creator: asset.creator,
          metadataURI: asset.metadataURI,
          royaltyBPS: Number(asset.defaultRoyaltyBPS ?? 0),
          tokenId: asset.tokenId,
          nftContract: asset.nftContract,
        };
      })
      .filter(Boolean) as {
      id: number;
      creator: string;
      metadataURI: string;
      royaltyBPS: number;
      tokenId: bigint;
      nftContract: string;
    }[];
  }, [assetsData]);

  const [metaMap, setMetaMap] = useState<
    Record<number, { name?: string; description?: string; image?: string; mimeType?: string; filename?: string }>
  >({});

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "3d" | "image" | "audio">("all");

  useEffect(() => {
    const missing = assets.filter((a) => !metaMap[a.id] && a.metadataURI);
    if (missing.length === 0) return;

    missing.forEach(async (a) => {
      const gateways = ipfsHttpGateways(a.metadataURI);
      let fetched = false;

      for (const url of gateways) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`status ${res.status}`);
          const json = await res.json();
          setMetaMap((prev) => ({
            ...prev,
            [a.id]: {
              name: json?.name,
              description: json?.description,
              image: json?.image,
              mimeType: json?.properties?.mimeType ?? json?.mimeType,
              filename: json?.properties?.filename ?? json?.filename,
            },
          }));
          fetched = true;
          break;
        } catch (err) {
          console.error("metadata fetch failed", { uri: a.metadataURI, url }, err);
        }
      }

      if (!fetched) {
        // Keep a placeholder so we don't retry endlessly
        setMetaMap((prev) => ({
          ...prev,
          [a.id]: {
            name: `Asset #${a.id}`,
            description: "Metadata unavailable",
          },
        }));
      }
    });
  }, [assets, metaMap]);

  // Selected asset for modal preview
  const selectedAsset = selectedId ? assets.find((a) => a.id === selectedId) : undefined;
  const selectedMeta = selectedAsset ? metaMap[selectedAsset.id] : undefined;
  const selectedImage = selectedMeta?.image;

  // License offers (on-chain)
  const { data: totalOffers } = useReadContract({
    address: licenseManager,
    abi: LicenseManagerABI,
    functionName: "totalOffers",
  });

  const offerQueries = useMemo(() => {
    if (!licenseManager || !totalOffers || totalOffers === 0n) return [];
    return Array.from({ length: Number(totalOffers) }, (_, idx) => ({
      address: licenseManager,
      abi: LicenseManagerABI as any,
      functionName: "offers",
      args: [BigInt(idx + 1)],
    }));
  }, [licenseManager, totalOffers]);

  const { data: offersData } = useReadContracts({
    contracts: offerQueries,
    query: { enabled: offerQueries.length > 0 },
  });

  const offersByAssetId = useMemo(() => {
    if (!offersData) return {};
    return offersData.reduce<Record<number, { assetId: number; offerId: number; price: bigint; ltype: number; preset: number; uri: string }>>(
      (acc, entry) => {
        if (!entry || entry.status !== "success") return acc;
        const [offerId, assetId, , price, , ltype, preset, maxSupply, sold, duration, active, uri] =
          entry.result as any;
        if (!active) return acc;
        acc[Number(assetId)] = { assetId: Number(assetId), offerId: Number(offerId), price, ltype, preset, uri };
        return acc;
      },
      {}
    );
  }, [offersData]);

  // Helper function to determine media category based on mimeType
  const getMediaCategory = (mimeType?: string): "3d" | "image" | "audio" | "other" => {
    if (!mimeType) return "other";
    if (mimeType.startsWith("model/") || mimeType.includes("gltf") || mimeType.includes("glb")) return "3d";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    return "other";
  };

  // Filter assets by category
  const filteredAssets = useMemo(() => {
    if (selectedCategory === "all") return assets;
    return assets.filter((asset) => {
      const meta = metaMap[asset.id];
      const category = getMediaCategory(meta?.mimeType);
      return category === selectedCategory;
    });
  }, [assets, metaMap, selectedCategory]);

  // Group assets by license preset
  const assetsByPreset = useMemo(() => {
    const grouped = {
      0: [] as typeof assets, // In-Game Commercial
      1: [] as typeof assets, // Trailer & Marketing
      2: [] as typeof assets, // Educational & Indie
      none: [] as typeof assets, // No license
    };

    filteredAssets.forEach((asset) => {
      const offer = offersByAssetId[asset.id];
      if (offer) {
        const preset = offer.preset;
        if (preset === 0 || preset === 1 || preset === 2) {
          grouped[preset].push(asset);
        } else {
          grouped.none.push(asset);
        }
      } else {
        grouped.none.push(asset);
      }
    });

    return grouped;
  }, [filteredAssets, offersByAssetId]);

  const [licenseMessage, setLicenseMessage] = useState<string | null>(null);
  const [purchasingLicense, setPurchasingLicense] = useState(false);
  const [userHasLicense, setUserHasLicense] = useState(false);
  const { writeContract: writeLicense, data: buyHash, error: buyError } = useWriteContract();
  const { isLoading: buyConfirming, isSuccess: buySuccess } = useWaitForTransactionReceipt({ hash: buyHash });
  const [pendingOffer, setPendingOffer] = useState<{ assetId: number; offer: { price: bigint; ltype: number; uri: string } } | null>(null);

  useEffect(() => {
    if (buySuccess) {
      setLicenseMessage("✅ Purchase confirmed on-chain");
      setPurchasingLicense(false);
      setUserHasLicense(true);

      // Sync to backend DB so portfolio can show it
      (async () => {
        if (!pendingOffer || !address) return;
        try {
          await fetch("/api/license/purchase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: pendingOffer.assetId,
              buyerAddress: address,
              priceInEth: formatEther(pendingOffer.offer.price),
              licenseType: pendingOffer.offer.ltype === 1 ? "EXCLUSIVE" : "NON_EXCLUSIVE",
              ltype: pendingOffer.offer.ltype,
              txHash: buyHash,
              uri: pendingOffer.offer.uri,
            }),
          });
        } catch (err) {
          console.error("Failed to sync license purchase to DB", err);
        }
      })();
    }
  }, [buySuccess, pendingOffer, address, buyHash]);

  useEffect(() => {
    if (buyError) {
      const errorMsg = getUserFriendlyError(buyError);
      if (errorMsg) {
        setLicenseMessage(errorMsg);
      }
      setPurchasingLicense(false);
    }
  }, [buyError]);

  useEffect(() => {
    const fetchLicense = async () => {
      if (!selectedAsset || !address) {
        setUserHasLicense(false);
        return;
      }
      try {
        const res = await fetch(`/api/license/check?assetId=${selectedAsset.id}&buyerAddress=${address}`);
        const json = await res.json();
        setUserHasLicense(Boolean(json?.hasLicense));
      } catch {
        setUserHasLicense(false);
      }
    };
    fetchLicense();
  }, [selectedAsset?.id, address]);

  // Pools
  const { data: totalPools } = useReadContract({
    address: fractionalizerAddress,
    abi: FractionalizerABI,
    functionName: "totalPools",
  });

  const poolQueries = useMemo(() => {
    if (!fractionalizerAddress || !totalPools || totalPools === 0n) return [];
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

  // Off-chain orders (Prisma)
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

  const [orders, setOrders] = useState<OffchainOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch("/api/orders/list");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load orders");
      }
      setOrders(json.data || []);
    } catch (err) {
      setOrdersError((err as Error).message);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchPendingMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/orders/pending-matches");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load pending matches");
      }
      setActiveMatches(json.data || []);
    } catch (err) {
      console.error("Error fetching pending matches:", err);
    }
  }, []);

  // Form states - must be declared before effects
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("SELL");
  const [sellPoolId, setSellPoolId] = useState("1");
  const [sellAmount, setSellAmount] = useState("0");
  const [sellPrice, setSellPrice] = useState("0.001");
  const [ftAddressInput, setFtAddressInput] = useState("");
  const [expiryDays, setExpiryDays] = useState(
    (process.env.NEXT_PUBLIC_ORDER_EXPIRY_DAYS || "7").toString()
  );
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [matchBuyId, setMatchBuyId] = useState("");
  const [matchSellId, setMatchSellId] = useState("");
  const [matchAmount, setMatchAmount] = useState("0");
  const [matching, setMatching] = useState(false);
  const [ordersMessage, setOrdersMessage] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Settlement tracking
  type OrderMatchDetail = {
    id: string;
    buyOrderId: string;
    sellOrderId: string;
    buyerAddress: string;
    sellerAddress: string;
    matchedAmount: string;
    matchedPrice: string;
    status: string;
  };
  const [activeMatches, setActiveMatches] = useState<OrderMatchDetail[]>([]);
  const [settlementInProgress, setSettlementInProgress] = useState<string | null>(null);

  // Calculate ftAddressForOrder early so it can be used in effects
  const selectedPool = useMemo(() => {
    const pid = Number(sellPoolId || "0");
    return pools.find((p) => p.id === pid);
  }, [sellPoolId, pools]);

  const ftAddressForOrder = selectedPool?.ftAddress || ftAddressInput;

  useEffect(() => {
    fetchOrders();
    fetchPendingMatches();
  }, [fetchOrders, fetchPendingMatches]);

  // Fetch token balance when SELL order is selected
  useEffect(() => {
    if (orderSide !== "SELL" || !address || !ftAddressForOrder || !chainId) {
      setTokenBalance("0");
      return;
    }

    const fetchBalance = async () => {
      setLoadingBalance(true);
      try {
        const res = await fetch(
          `/api/token/balance?userAddress=${address}&tokenAddress=${ftAddressForOrder}&chainId=${chainId}`
        );
        const json = await res.json();
        if (json.success) {
          setTokenBalance(json.formattedBalance);
        } else {
          setTokenBalance("0");
        }
      } catch (err) {
        console.error("Error fetching balance:", err);
        setTokenBalance("0");
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [orderSide, address, ftAddressForOrder, chainId]);

  const buyOrders = useMemo(() => orders.filter((o) => o.side === "BUY"), [orders]);
  const sellOrders = useMemo(() => orders.filter((o) => o.side === "SELL"), [orders]);

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

  const handleCreateOrder = async () => {
    if (!address || !chainId) {
      setOrdersMessage("Connect wallet to create an order.");
      return;
    }
    const amountWei = parseUnits(sellAmount || "0", 18);
    const priceWei = parseEther(sellPrice || "0");
    if (!ftAddressForOrder) {
      setOrdersMessage("FT address is required (select pool or enter manually).");
      return;
    }
    if (amountWei === 0n || priceWei === 0n) {
      setOrdersMessage("Amount and price must be greater than 0.");
      return;
    }

    // For SELL orders, check if user has sufficient balance
    if (orderSide === "SELL") {
      const userBalance = parseUnits(tokenBalance || "0", 18);
      if (amountWei > userBalance) {
        setOrdersMessage(
          `Insufficient balance. You have ${tokenBalance} tokens but need ${sellAmount}.`
        );
        return;
      }
    }

    const days = Number(expiryDays || "0");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (isNaN(days) ? 7 : days));

    setCreatingOrder(true);
    setOrdersMessage(null);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          side: orderSide,
          poolId: sellPoolId,
          ftAddress: ftAddressForOrder,
          amount: amountWei.toString(),
          pricePerToken: priceWei.toString(),
          chainId,
          signature: null,
          nonce: 0,
          expiresAt: expiresAt.toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create order");
      }
      setOrdersMessage("Order created off-chain. Finding matches...");
      setSellAmount("0");

      // Auto-match the order
      try {
        const orderId = json.order.id;
        const matchRes = await fetch("/api/orders/auto-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const matchJson = await matchRes.json();

        if (matchJson.success && matchJson.matchesCreated > 0) {
          setOrdersMessage(
            `✅ Order created and auto-matched with ${matchJson.matchesCreated} order(s)! Ready for on-chain settlement.`
          );
        }
      } catch (err) {
        console.error("Auto-match error:", err);
      }

      await fetchOrders();
      await fetchPendingMatches();
    } catch (err) {
      setOrdersMessage((err as Error).message);
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!address) {
      setOrdersMessage("Connect wallet to cancel your order.");
      return;
    }
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, userAddress: address }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to cancel order");
      }
      setOrdersMessage("Order cancelled.");
      await fetchOrders();
    } catch (err) {
      setOrdersMessage((err as Error).message);
    }
  };

  const handleMatchOrders = async () => {
    const amountWei = parseUnits(matchAmount || "0", 18);
    if (amountWei === 0n) {
      setOrdersMessage("Match amount must be greater than 0.");
      return;
    }
    if (!matchBuyId || !matchSellId) {
      setOrdersMessage("Buy order ID and sell order ID are required.");
      return;
    }
    setMatching(true);
    setOrdersMessage(null);
    try {
      const res = await fetch("/api/orders/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyOrderId: matchBuyId,
          sellOrderId: matchSellId,
          matchAmount: amountWei.toString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to match orders");
      }

      // Fetch match details to add to activeMatches
      if (json.match) {
        const buyOrder = orders.find((o) => o.id === matchBuyId);
        const sellOrder = orders.find((o) => o.id === matchSellId);
        if (buyOrder && sellOrder) {
          const newMatch: OrderMatchDetail = {
            id: json.match.id,
            buyOrderId: json.match.buyOrderId,
            sellOrderId: json.match.sellOrderId,
            buyerAddress: buyOrder.userAddress,
            sellerAddress: sellOrder.userAddress,
            matchedAmount: json.match.matchedAmount,
            matchedPrice: json.match.matchedPrice,
            status: json.match.status,
          };
          setActiveMatches((prev) => [...prev, newMatch]);
        }
      }

      setOrdersMessage("Match created. Ready to settle!");
      setMatchAmount("0");
      await fetchOrders();
    } catch (err) {
      setOrdersMessage((err as Error).message);
    } finally {
      setMatching(false);
    }
  };

  const handleSettleMatch = async (matchId: string) => {
    if (!address || !chainId) {
      setOrdersMessage("Connect wallet to settle orders.");
      return;
    }

    setSettlementInProgress(matchId);
    setOrdersMessage(null);
    try {
      // Execute trade on-chain
      await executeTrade(matchId);

      // Update activeMatches to reflect settled status
      setActiveMatches((prev) =>
        prev.map((m) =>
          m.id === matchId ? { ...m, status: "SETTLED" } : m
        )
      );

      setOrdersMessage("✅ Order settled on-chain! Tokens transferred to buyer.");
      await fetchOrders();
      await fetchPendingMatches();
    } catch (err) {
      setOrdersMessage((err as Error).message);
    } finally {
      setSettlementInProgress(null);
    }
  };

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">License Market</h1>
            <p className="text-gray-400 mt-1">
              {totalAssets ? `${totalAssets.toString()} assets registered` : "Registered assets + licenses"}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/create"
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600 hover:to-pink-600 border border-purple-500/30 hover:border-purple-500 rounded-lg font-semibold text-white transition-all backdrop-blur-sm shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
            >
              + List Asset
            </Link>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                selectedCategory === "all"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              All Assets
            </button>
            <button
              onClick={() => setSelectedCategory("3d")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                selectedCategory === "3d"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              3D Models
            </button>
            <button
              onClick={() => setSelectedCategory("image")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                selectedCategory === "image"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setSelectedCategory("audio")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                selectedCategory === "audio"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              Audio
            </button>
          </div>
        </div>

        {/* Asset Grid - Grouped by License Preset */}
        {assetsLoading ? (
          <div className="text-center text-gray-400 py-10">Loading assets...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No assets yet</h3>
            <p className="text-gray-500 mb-6">Be the first to list your game asset!</p>
            <Link
              href="/create"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
            >
              List Your Asset
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* In-Game Commercial Section */}
            {assetsByPreset[0].length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-gradient-to-b from-purple-500 to-purple-700 rounded-full"></div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">In-Game Commercial</h2>
                    <p className="text-sm text-gray-400">Assets for commercial game usage</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent"></div>
                </div>
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {assetsByPreset[0].map((asset) => {
                    const meta = metaMap[asset.id];
                    const imgSrc = meta?.image;
                    const offer = offersByAssetId[asset.id];
                    return (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedId(asset.id)}
                        className="text-left bg-gradient-to-br from-gray-900 to-gray-900/50 border border-purple-500/30 rounded-xl overflow-hidden hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all cursor-pointer"
                      >
                        <div className="aspect-square bg-gray-800 flex items-center justify-center relative">
                          {imgSrc ? (
                            <AssetMedia
                              src={imgSrc}
                              alt={meta?.name || `Asset ${asset.id}`}
                              mimeType={meta?.mimeType}
                              filename={meta?.filename}
                              interactive={false}
                            />
                          ) : (
                            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600/90 backdrop-blur-sm text-white text-xs font-semibold rounded">
                            In-Game
                          </div>
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-semibold text-white">{meta?.name || `Asset #${asset.id}`}</h3>
                          <p className="text-sm text-gray-400 line-clamp-2">{meta?.description || "No description"}</p>
                          {offer && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                              <span className="text-lg font-bold text-purple-400">{formatEther(offer.price)} IP</span>
                              <span className="text-xs text-gray-500">#{asset.tokenId.toString()}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Trailer & Marketing Section */}
            {assetsByPreset[1].length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-700 rounded-full"></div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Trailer & Marketing</h2>
                    <p className="text-sm text-gray-400">Assets for promotional content</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-blue-500/20 to-transparent"></div>
                </div>
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {assetsByPreset[1].map((asset) => {
                    const meta = metaMap[asset.id];
                    const imgSrc = meta?.image;
                    const offer = offersByAssetId[asset.id];
                    return (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedId(asset.id)}
                        className="text-left bg-gradient-to-br from-gray-900 to-gray-900/50 border border-blue-500/30 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 transition-all cursor-pointer"
                      >
                        <div className="aspect-square bg-gray-800 flex items-center justify-center relative">
                          {imgSrc ? (
                            <AssetMedia
                              src={imgSrc}
                              alt={meta?.name || `Asset ${asset.id}`}
                              mimeType={meta?.mimeType}
                              filename={meta?.filename}
                              interactive={false}
                            />
                          ) : (
                            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600/90 backdrop-blur-sm text-white text-xs font-semibold rounded">
                            Marketing
                          </div>
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-semibold text-white">{meta?.name || `Asset #${asset.id}`}</h3>
                          <p className="text-sm text-gray-400 line-clamp-2">{meta?.description || "No description"}</p>
                          {offer && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                              <span className="text-lg font-bold text-blue-400">{formatEther(offer.price)} IP</span>
                              <span className="text-xs text-gray-500">#{asset.tokenId.toString()}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Educational & Indie Section */}
            {assetsByPreset[2].length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-green-700 rounded-full"></div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Educational & Indie</h2>
                    <p className="text-sm text-gray-400">Assets for educational and indie projects</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-green-500/20 to-transparent"></div>
                </div>
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {assetsByPreset[2].map((asset) => {
                    const meta = metaMap[asset.id];
                    const imgSrc = meta?.image;
                    const offer = offersByAssetId[asset.id];
                    return (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedId(asset.id)}
                        className="text-left bg-gradient-to-br from-gray-900 to-gray-900/50 border border-green-500/30 rounded-xl overflow-hidden hover:border-green-500 hover:shadow-lg hover:shadow-green-500/20 transition-all cursor-pointer"
                      >
                        <div className="aspect-square bg-gray-800 flex items-center justify-center relative">
                          {imgSrc ? (
                            <AssetMedia
                              src={imgSrc}
                              alt={meta?.name || `Asset ${asset.id}`}
                              mimeType={meta?.mimeType}
                              filename={meta?.filename}
                              interactive={false}
                            />
                          ) : (
                            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          <div className="absolute top-2 right-2 px-2 py-1 bg-green-600/90 backdrop-blur-sm text-white text-xs font-semibold rounded">
                            Edu/Indie
                          </div>
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-semibold text-white">{meta?.name || `Asset #${asset.id}`}</h3>
                          <p className="text-sm text-gray-400 line-clamp-2">{meta?.description || "No description"}</p>
                          {offer && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                              <span className="text-lg font-bold text-green-400">{formatEther(offer.price)} IP</span>
                              <span className="text-xs text-gray-500">#{asset.tokenId.toString()}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* No License Section */}
            {assetsByPreset.none.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-gradient-to-b from-gray-500 to-gray-700 rounded-full"></div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Other Assets</h2>
                    <p className="text-sm text-gray-400">Assets without license offers</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-500/20 to-transparent"></div>
                </div>
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {assetsByPreset.none.map((asset) => {
                    const meta = metaMap[asset.id];
                    const imgSrc = meta?.image;
                    return (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedId(asset.id)}
                        className="text-left bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition cursor-pointer"
                      >
                        <div className="aspect-square bg-gray-800 flex items-center justify-center">
                          {imgSrc ? (
                            <AssetMedia
                              src={imgSrc}
                              alt={meta?.name || `Asset ${asset.id}`}
                              mimeType={meta?.mimeType}
                              filename={meta?.filename}
                              interactive={false}
                            />
                          ) : (
                            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-semibold">{meta?.name || `Asset #${asset.id}`}</h3>
                          <p className="text-sm text-gray-400 line-clamp-2">{meta?.description || "No description"}</p>
                          <div className="flex gap-2 flex-wrap pt-2">
                            <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded">No License</span>
                            <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                              #{asset.tokenId.toString()}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {selectedAsset && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center px-4"
            onClick={() => setSelectedId(null)}
          >
            <div
              className="bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/20 border border-purple-500/20 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden grid lg:grid-cols-2 shadow-2xl shadow-purple-500/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-br from-gray-950 to-gray-900 min-h-[420px] flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-blue-600/5"></div>
                {selectedImage ? (
                  <div className="w-full h-full flex flex-col items-center justify-center relative z-10">
                    <AssetMedia
                      src={selectedImage}
                      alt={selectedMeta?.name || `Asset ${selectedAsset.id}`}
                      mimeType={selectedMeta?.mimeType}
                      filename={selectedMeta?.filename}
                      interactive
                      className="w-full h-full object-contain"
                    />
                    {/* Audio Player for audio files */}
                    {selectedMeta?.mimeType?.startsWith("audio/") && (
                      <div className="absolute bottom-6 left-6 right-6 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl p-4 shadow-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <audio
                              controls
                              className="w-full"
                              style={{
                                height: '40px',
                                filter: 'invert(0.9) hue-rotate(180deg)',
                              }}
                            >
                              {(() => {
                                const gateways = ipfsHttpGateways(selectedImage);
                                return gateways.map((url, idx) => (
                                  <source key={idx} src={url} type={selectedMeta?.mimeType} />
                                ));
                              })()}
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500">No preview</div>
                )}
              </div>

              <div className="p-8 space-y-6 overflow-auto">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                      {selectedMeta?.name || `Asset #${selectedAsset.id}`}
                    </h3>
                    <p className="text-gray-400 text-base leading-relaxed">
                      {selectedMeta?.description || "No description"}
                    </p>
                  </div>
                  <button
                    className="text-gray-400 hover:text-white hover:bg-gray-800/50 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
                    onClick={() => setSelectedId(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Token ID</p>
                    <p className="text-lg font-bold text-purple-300">#{selectedAsset.tokenId.toString()}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Royalty</p>
                    <p className="text-lg font-bold text-blue-300">{(selectedAsset.royaltyBPS / 100).toFixed(2)}%</p>
                  </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Creator Address</p>
                  <p className="text-sm text-gray-300 font-mono break-all bg-gray-900/50 px-3 py-2 rounded-lg">
                    {selectedAsset.creator}
                  </p>
                </div>

                {/* License section */}
                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
                    <h4 className="text-xl font-bold text-white">License Information</h4>
                  </div>
                  {(() => {
                    const offer = selectedAsset ? offersByAssetId[selectedAsset.id] : null;
                    if (!offer) {
                      return (
                        <div className="text-center py-6">
                          <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-400">Creator has not published a license yet.</p>
                        </div>
                      );
                    }
                    const typeLabel = offer.ltype === 1 ? "EXCLUSIVE" : offer.ltype === 2 ? "DERIVATIVE" : "NON_EXCLUSIVE";
                    const typeBgColor = offer.ltype === 1 ? "from-yellow-500/20 to-orange-500/20 border-yellow-500/30" : "from-green-500/20 to-emerald-500/20 border-green-500/30";
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`bg-gradient-to-br ${typeBgColor} border rounded-xl p-4`}>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">License Type</p>
                            <p className="text-base font-bold text-white">{typeLabel}</p>
                          </div>
                          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Price</p>
                            <p className="text-base font-bold text-white">{formatEther(offer.price)} IP</p>
                          </div>
                        </div>

                        {licenseMessage && (
                          <div
                            className={`text-sm p-4 rounded-xl backdrop-blur-sm ${
                              licenseMessage.includes("✅")
                                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                                : "bg-red-500/10 border border-red-500/30 text-red-400"
                            }`}
                          >
                            {licenseMessage}
                          </div>
                        )}

                        <button
                          onClick={async () => {
                            if (!selectedAsset || !address) {
                              setLicenseMessage("Please connect your wallet first");
                              return;
                            }
                            if (!licenseManager) {
                              setLicenseMessage("Contract address not configured");
                              return;
                            }

                            // Track which offer we are buying for DB sync later
                            setPendingOffer({
                              assetId: selectedAsset.id,
                              offer: { price: offer.price, ltype: offer.ltype, uri: offer.uri },
                            });

                            setPurchasingLicense(true);
                            setLicenseMessage("Confirm in wallet...");
                            try {
                              await writeLicense({
                                address: licenseManager,
                                abi: LicenseManagerABI,
                                functionName: "buyLicense",
                                args: [BigInt(offer.offerId)],
                                value: offer.price,
                              });
                              setLicenseMessage("Waiting for confirmation...");
                            } catch (err: any) {
                              const errorMsg = getUserFriendlyError(err);
                              if (errorMsg) {
                                setLicenseMessage(errorMsg);
                              } else {
                                setLicenseMessage(null);
                              }
                              setPurchasingLicense(false);
                            }
                          }}
                          disabled={purchasingLicense || userHasLicense}
                          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-[1.02] disabled:transform-none disabled:shadow-none"
                        >
                          {userHasLicense
                            ? "✓ Already Owned"
                            : offer.ltype === 1 && userHasLicense
                              ? "Exclusive Limit Reached"
                              : purchasingLicense || buyConfirming
                                ? "Purchasing..."
                                : "Buy License"}
                        </button>

                        {buySuccess && (
                          <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            ✅ Purchase confirmed: {buyHash}
                          </div>
                        )}
                        {buyError && (
                          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 break-all">
                            {buyError.message}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
      </div>
    </div>
  );
}
