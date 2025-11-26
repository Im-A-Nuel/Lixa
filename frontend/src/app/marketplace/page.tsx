"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseEther, parseUnits, formatEther, formatUnits } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import SecondaryMarketABI from "@/lib/contracts/SecondaryMarket.json";
import { ipfsToHttp, ipfsHttpGateways } from "@/lib/ipfs";
import { AssetMedia } from "@/components/AssetMedia";
import Header from "@/components/Header";

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

export default function MarketplacePage() {
  const { chainId, address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const registryAddress = chainId
    ? getContractAddress(chainId, "AssetRegistry")
    : undefined;
  const fractionalizerAddress = chainId
    ? getContractAddress(chainId, "Fractionalizer")
    : undefined;
  const secondaryAddress = chainId
    ? getContractAddress(chainId, "SecondaryMarket")
    : undefined;

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
    Record<
      number,
      {
        name?: string;
        description?: string;
        image?: string;
        mimeType?: string;
        filename?: string;
      }
    >
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
          console.error(
            "metadata fetch failed",
            { uri: a.metadataURI, url },
            err
          );
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

  const selectedAsset = selectedId
    ? assets.find((a) => a.id === selectedId)
    : undefined;
  const selectedMeta = selectedAsset ? metaMap[selectedAsset.id] : undefined;
  const selectedImage = selectedMeta?.image;

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
        const [
          nftContract,
          tokenId,
          ftAddress,
          totalFractions,
          originalOwner,
          salePricePerToken,
          amountForSale,
          sold,
          active,
        ] = entry.result as any;
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

  // Orders
  const { data: totalOrders } = useReadContract({
    address: secondaryAddress,
    abi: SecondaryMarketABI,
    functionName: "totalOrders",
  });

  const orderQueries = useMemo(() => {
    if (!secondaryAddress || !totalOrders || totalOrders === 0n) return [];
    return Array.from({ length: Number(totalOrders) }, (_, idx) => ({
      address: secondaryAddress,
      abi: SecondaryMarketABI,
      functionName: "getOrderDetails",
      args: [BigInt(idx + 1)],
    }));
  }, [secondaryAddress, totalOrders]);

  const { data: ordersData, refetch: refetchOrders } = useReadContracts({
    contracts: orderQueries,
    query: { enabled: orderQueries.length > 0 },
  });

  const orders = useMemo(() => {
    if (!ordersData) return [];
    return ordersData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        const [
          poolId,
          ftAddress,
          seller,
          amount,
          pricePerToken,
          active,
          createdAt,
        ] = entry.result as any;
        if (!active) return null;
        return {
          id: idx + 1,
          poolId,
          ftAddress,
          seller,
          amount,
          pricePerToken,
          createdAt,
        };
      })
      .filter(Boolean) as {
      id: number;
      poolId: bigint;
      ftAddress: string;
      seller: string;
      amount: bigint;
      pricePerToken: bigint;
      createdAt: bigint;
    }[];
  }, [ordersData]);

  // Form states
  const [sellPoolId, setSellPoolId] = useState("1");
  const [sellAmount, setSellAmount] = useState("0");
  const [sellPrice, setSellPrice] = useState("0.001");
  const [orderAmounts, setOrderAmounts] = useState<Record<number, string>>({});

  const selectedPool = useMemo(() => {
    const pid = Number(sellPoolId || "0");
    return pools.find((p) => p.id === pid);
  }, [sellPoolId, pools]);

  const { data: sellAllowance } = useReadContract({
    address: selectedPool
      ? (selectedPool.ftAddress as `0x${string}`)
      : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      selectedPool && address && secondaryAddress
        ? [address, secondaryAddress]
        : undefined,
    query: { enabled: Boolean(selectedPool && address && secondaryAddress) },
  });

  const {
    writeContractAsync,
    data: txHash,
    error: txError,
  } = useWriteContract();
  const { isLoading: confirmingTx } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Create sell order
  const handleCreateAsk = async () => {
    if (!selectedPool || !secondaryAddress || !address) return;
    const amountWei = parseUnits(sellAmount || "0", 18);
    const priceWei = parseEther(sellPrice || "0");
    if (amountWei === 0n || priceWei === 0n) return;
    try {
      if (!sellAllowance || sellAllowance < amountWei) {
        const approveHash = await writeContractAsync({
          address: selectedPool.ftAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [secondaryAddress, amountWei],
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: approveHash as `0x${string}`,
          });
        }
      }
      const createHash = await writeContractAsync({
        address: secondaryAddress,
        abi: SecondaryMarketABI,
        functionName: "createSellOrder",
        args: [
          BigInt(selectedPool.id),
          selectedPool.ftAddress,
          amountWei,
          priceWei,
        ],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: createHash as `0x${string}`,
        });
      }
      await refetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  // Buy order
  const handleBuyOrder = async (
    order: (typeof orders)[number],
    input: string
  ) => {
    if (!secondaryAddress) return;
    const amtWei = parseUnits(input || "0", 18);
    if (amtWei === 0n || amtWei > order.amount) return;
    const cost = (order.pricePerToken * amtWei) / 10n ** 18n;
    try {
      const buyHash = await writeContractAsync({
        address: secondaryAddress,
        abi: SecondaryMarketABI,
        functionName: "buyFromOrder",
        args: [BigInt(order.id), amtWei],
        value: cost,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: buyHash as `0x${string}`,
        });
      }
      await refetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  // Cancel
  const handleCancelOrder = async (orderId: number) => {
    if (!secondaryAddress) return;
    try {
      const cancelHash = await writeContractAsync({
        address: secondaryAddress,
        abi: SecondaryMarketABI,
        functionName: "cancelOrder",
        args: [BigInt(orderId)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: cancelHash as `0x${string}`,
        });
      }
      await refetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Marketplace</h1>
            <p className="text-gray-400 mt-1">
              {totalAssets
                ? `${totalAssets.toString()} assets listed`
                : "Browse game assets"}
            </p>
          </div>
          <Link
            href="/create"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
          >
            + List Asset
          </Link>
        </div>

        {/* Asset Grid */}
        {assetsLoading ? (
          <div className="text-center text-gray-400 py-10">
            Loading assets...
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              No assets yet
            </h3>
            <p className="text-gray-500 mb-6">
              Be the first to list your game asset!
            </p>
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
                <div
                  key={asset.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition cursor-pointer"
                  onClick={() => setSelectedId(asset.id)}
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
                      <svg
                        className="w-12 h-12 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                    <h3 className="font-semibold">
                      {meta?.name || `Asset #${asset.id}`}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {meta?.description || "No description"}
                    </p>
                    <p className="text-sm text-gray-400">
                      Royalty: {(asset.royaltyBPS / 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500 break-all">
                      Creator: {asset.creator}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">
                        Registered
                      </span>
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                        Token #{asset.tokenId.toString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lightbox for asset preview */}
        {selectedAsset && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800">
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedMeta?.name || `Asset #${selectedAsset.id}`}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Token #{selectedAsset.tokenId.toString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-0">
                <div className="bg-gray-950 aspect-square md:h-full flex items-center justify-center">
                  {selectedImage ? (
                    <AssetMedia
                      src={selectedImage}
                      alt={selectedMeta?.name || `Asset ${selectedAsset.id}`}
                      mimeType={selectedMeta?.mimeType}
                      filename={selectedMeta?.filename}
                      className="w-full h-full object-contain bg-gray-950"
                      interactive={true}
                    />
                  ) : (
                    <div className="text-gray-500">No preview</div>
                  )}
                </div>
                <div className="p-6 space-y-3 overflow-auto">
                  <p className="text-sm text-gray-300 whitespace-pre-line">
                    {selectedMeta?.description || "No description"}
                  </p>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>Creator: {selectedAsset.creator}</p>
                    <p>Metadata: {selectedAsset.metadataURI}</p>
                    {selectedMeta?.filename && (
                      <p>File: {selectedMeta.filename}</p>
                    )}
                    {selectedMeta?.mimeType && (
                      <p>Mime: {selectedMeta.mimeType}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
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
          </div>
        )}

        {/* Secondary Market */}
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Secondary Market</h2>
              <p className="text-gray-400">
                Create sell orders and buy fractional tokens.
              </p>
            </div>
            {!isConnected && <ConnectButton />}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Create Sell Order</h3>
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">Pool ID</label>
                <input
                  type="number"
                  min="1"
                  value={sellPoolId}
                  onChange={(e) => setSellPoolId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">
                  Amount (tokens)
                </label>
                <input
                  type="text"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-gray-400">
                  Price per token (ETH)
                </label>
                <input
                  type="text"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={handleCreateAsk}
                disabled={!isConnected || confirmingTx}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
              >
                {confirmingTx ? "Submitting..." : "Create Order"}
              </button>
              {txError && (
                <p className="text-sm text-red-400 break-all">
                  Error: {txError.message}
                </p>
              )}
              {selectedPool && (
                <p className="text-xs text-gray-500 break-all">
                  FT: {selectedPool.ftAddress}
                </p>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Active Orders</h3>
              {orders.length === 0 ? (
                <p className="text-gray-400 text-sm">No active orders.</p>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="border border-gray-800 rounded p-3 space-y-2"
                    >
                      <div className="flex justify-between text-sm text-gray-300">
                        <span>Order #{o.id}</span>
                        <span>Pool #{o.poolId.toString()}</span>
                      </div>
                      <p className="text-xs text-gray-400 break-all">
                        FT: {o.ftAddress}
                      </p>
                      <p className="text-xs text-gray-400 break-all">
                        Seller: {o.seller}
                      </p>
                      <p className="text-sm text-gray-400">
                        Price: {formatEther(o.pricePerToken)} ETH | Amount:{" "}
                        {formatUnits(o.amount, 18)}
                      </p>

                      <div className="space-y-2">
                        <label className="block text-xs text-gray-400">
                          Buy amount (tokens)
                        </label>
                        <input
                          type="text"
                          value={orderAmounts[o.id] ?? "0"}
                          onChange={(e) =>
                            setOrderAmounts((prev) => ({
                              ...prev,
                              [o.id]: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleBuyOrder(o, orderAmounts[o.id] ?? "0")
                            }
                            disabled={!isConnected}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition text-sm"
                          >
                            Buy
                          </button>
                          {address &&
                            address.toLowerCase() ===
                              o.seller.toLowerCase() && (
                              <button
                                onClick={() => handleCancelOrder(o.id)}
                                className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition text-sm"
                              >
                                Cancel
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
