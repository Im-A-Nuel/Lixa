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
      abi: AssetRegistryABI,
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
      abi: LicenseManagerABI,
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
      setLicenseMessage(buyError.message || "Failed to confirm transaction");
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
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
            >
              + List Asset
            </Link>
          </div>
        </div>

        {/* Asset Grid */}
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
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {assets.map((asset) => {
              const meta = metaMap[asset.id];
              const imgSrc = meta?.image;
              return (
                <button
                  key={asset.id}
                  onClick={() => setSelectedId(asset.id)}
                  className="text-left bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500 transition cursor-pointer"
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold">{meta?.name || `Asset #${asset.id}`}</h3>
                    <p className="text-sm text-gray-400">
                      {meta?.description || "No description"}
                    </p>
                    <p className="text-sm text-gray-400">Royalty: {(asset.royaltyBPS / 100).toFixed(2)}%</p>
                    <p className="text-xs text-gray-500 break-all">Creator: {asset.creator}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">Registered</span>
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                        Token #{asset.tokenId.toString()}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedAsset && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4"
            onClick={() => setSelectedId(null)}
          >
            <div
              className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden grid lg:grid-cols-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gray-950 min-h-[420px] flex items-center justify-center">
                {selectedImage ? (
                  <AssetMedia
                    src={selectedImage}
                    alt={selectedMeta?.name || `Asset ${selectedAsset.id}`}
                    mimeType={selectedMeta?.mimeType}
                    filename={selectedMeta?.filename}
                    interactive
                    className="w-full h-full object-contain bg-gray-950"
                  />
                ) : (
                  <div className="text-gray-500">No preview</div>
                )}
              </div>

              <div className="p-6 space-y-4 overflow-auto">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold">{selectedMeta?.name || `Asset #${selectedAsset.id}`}</h3>
                    <p className="text-gray-400 text-sm">{selectedMeta?.description || "No description"}</p>
                  </div>
                  <button
                    className="text-gray-400 hover:text-white text-xl leading-none"
                    onClick={() => setSelectedId(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="text-sm text-gray-300 space-y-1">
                  <p>Token ID: #{selectedAsset.tokenId.toString()}</p>
                  <p>Royalty: {(selectedAsset.royaltyBPS / 100).toFixed(2)}%</p>
                  <p className="break-all">Creator: {selectedAsset.creator}</p>
                  <p className="break-all">Metadata: {selectedAsset.metadataURI}</p>
                  {selectedMeta?.filename && <p>File: {selectedMeta.filename}</p>}
                  {selectedMeta?.mimeType && <p>Mime: {selectedMeta.mimeType}</p>}
                </div>

                {/* License section */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold">License</h4>
                  {(() => {
                    const offer = selectedAsset ? offersByAssetId[selectedAsset.id] : null;
                    if (!offer) {
                      return <p className="text-sm text-gray-400">Creator has not published a license yet.</p>;
                    }
                    const typeLabel = offer.ltype === 1 ? "EXCLUSIVE" : offer.ltype === 2 ? "DERIVATIVE" : "NON_EXCLUSIVE";
                    return (
                      <>
                        <p className="text-sm text-gray-300">Type: {typeLabel}</p>
                        <p className="text-sm text-gray-300">Price: {formatEther(offer.price)} ETH</p>
                        <p className="text-xs text-gray-500 break-all">URI: {offer.uri}</p>

                        {licenseMessage && (
                          <div
                            className={`text-sm p-2 rounded ${
                              licenseMessage.includes("✅")
                                ? "bg-green-900/20 border border-green-700 text-green-400"
                                : "bg-red-900/20 border border-red-700 text-red-400"
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
                              setLicenseMessage(err?.message || "Failed to send transaction");
                              setPurchasingLicense(false);
                            }
                          }}
                          disabled={purchasingLicense || userHasLicense}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold"
                        >
                          {userHasLicense
                            ? "Already owned"
                            : offer.ltype === 1 && userHasLicense
                              ? "Exclusive limit reached"
                              : purchasingLicense || buyConfirming
                                ? "Purchasing..."
                                : "Buy License"}
                        </button>

                        {buySuccess && (
                          <div className="text-xs text-green-400">
                            ✅ Purchase confirmed: {buyHash}
                          </div>
                        )}
                        {buyError && (
                          <div className="text-xs text-red-400 break-all">
                            {buyError.message}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex gap-2 flex-wrap pt-2">
                  {selectedMeta?.image &&
                    ipfsHttpGateways(selectedMeta.image).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-gray-800 text-gray-100 rounded-lg text-sm hover:bg-gray-700 transition"
                      >
                        Open media
                      </a>
                    ))}
                  {selectedAsset.metadataURI &&
                    ipfsHttpGateways(selectedAsset.metadataURI).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-gray-800 text-gray-100 rounded-lg text-sm hover:bg-gray-700 transition"
                      >
                        Open metadata
                      </a>
                    ))}
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
