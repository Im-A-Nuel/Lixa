"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import Link from "next/link";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import LicenseNFTABI from "@/lib/contracts/LicenseNFT.json";
import LicenseManagerABI from "@/lib/contracts/LicenseManager.json";
import { MarketplaceNav } from "@/components/MarketplaceNav";
import { ipfsHttpGateways } from "@/lib/ipfs";
import { getUserFriendlyError } from "@/lib/walletErrors";
import { AssetMedia } from "@/components/AssetMedia";

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
];

type TabType = "myAssets" | "licenses" | "fractional";
type AssetCategory = "all" | "3d" | "image" | "audio";

export default function PortfolioPage() {
  const { address, chainId, isConnected } = useAccount();
  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;
  const licenseNftAddress = chainId ? getContractAddress(chainId, "LicenseNFT") : undefined;
  const licenseManagerAddress = chainId ? getContractAddress(chainId, "LicenseManager") : undefined;

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("myAssets");
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("all");

  // License state
  const [ownedLicenses, setOwnedLicenses] = useState<
    { tokenId: bigint; name?: string; description?: string; licenseType?: string; offerId?: string; assetId?: string; uri?: string; image?: string }[]
  >([]);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  // Asset metadata state
  const [assetMetadata, setAssetMetadata] = useState<Record<number, any>>({});

  // Registered assets
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

  const { data: assetsData } = useReadContracts({
    contracts: assetQueries,
    query: { enabled: assetQueries.length > 0 },
  });

  const registeredAssets = useMemo(() => {
    if (!assetsData || !address) return [];
    return assetsData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        const a: any = entry.result;
        if (!a?.exists) return null;
        if (a.creator.toLowerCase() !== address.toLowerCase()) return null;
        return { ...a, assetId: idx + 1 };
      })
      .filter(Boolean) as any[];
  }, [assetsData, address]);

  // Fetch asset metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      if (registeredAssets.length === 0) return;

      const metadataMap: Record<number, any> = {};
      for (const asset of registeredAssets) {
        try {
          const gateways = ipfsHttpGateways(asset.metadataURI);
          for (const gateway of gateways) {
            try {
              const res = await fetch(gateway);
              if (!res.ok) continue;
              const json = await res.json();
              metadataMap[asset.assetId] = json;
              break;
            } catch {
              continue;
            }
          }
        } catch (error) {
          console.error(`Failed to fetch metadata for asset ${asset.assetId}`, error);
        }
      }
      setAssetMetadata(metadataMap);
    };

    fetchMetadata();
  }, [registeredAssets]);

  // Categorize assets by type
  const categorizedAssets = useMemo(() => {
    const metadata = assetMetadata;
    return {
      all: registeredAssets,
      "3d": registeredAssets.filter((a) => {
        const meta = metadata[a.assetId];
        const mimeType = meta?.properties?.mimeType || "";
        return mimeType.startsWith("model/") || mimeType === "application/octet-stream";
      }),
      image: registeredAssets.filter((a) => {
        const meta = metadata[a.assetId];
        const mimeType = meta?.properties?.mimeType || "";
        return mimeType.startsWith("image/");
      }),
      audio: registeredAssets.filter((a) => {
        const meta = metadata[a.assetId];
        const mimeType = meta?.properties?.mimeType || "";
        return mimeType.startsWith("audio/");
      }),
    };
  }, [registeredAssets, assetMetadata]);

  // Fractional holdings
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

  const balanceQueries = useMemo(() => {
    if (!poolData || !address) return [];
    return poolData.map((entry) => {
      if (!entry || entry.status !== "success") return null;
      const [, , ftAddress] = entry.result as any;
      return {
        address: ftAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      };
    }).filter(Boolean) as any[];
  }, [poolData, address]);

  const { data: balancesData } = useReadContracts({
    contracts: balanceQueries,
    query: { enabled: balanceQueries.length > 0 },
  });

  const fractionalHoldings = useMemo(() => {
    if (!poolData || !balancesData) return [];
    return poolData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        if (!balancesData[idx] || balancesData[idx].status !== "success") return null;
        const bal = balancesData[idx].result as bigint;
        if (bal === 0n) return null;
        const [nftContract, tokenId, ftAddress, totalFractions, originalOwner, , amountForSale, sold, active] =
          entry.result as any;
        return {
          id: idx + 1,
          nftContract,
          tokenId,
          ftAddress,
          totalFractions,
          originalOwner,
          amountForSale,
          sold,
          active,
          balance: bal,
        };
      })
      .filter(Boolean) as {
      id: number;
      nftContract: string;
      tokenId: bigint;
      ftAddress: string;
      totalFractions: bigint;
      originalOwner: string;
      amountForSale: bigint;
      sold: bigint;
      active: boolean;
      balance: bigint;
    }[];
  }, [poolData, balancesData]);

  // License NFTs owned (on-chain)
  const { data: licenseTokenIds, isLoading: loadingLicenseIds } = useReadContract({
    address: licenseNftAddress,
    abi: LicenseNFTABI.abi,
    functionName: "tokensOfOwner",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && licenseNftAddress) },
  });

  const licenseUriQueries = useMemo(() => {
    if (!licenseTokenIds || !Array.isArray(licenseTokenIds)) return [];
    return (licenseTokenIds as bigint[]).map((tid) => ({
      address: licenseNftAddress as `0x${string}`,
      abi: LicenseNFTABI.abi as any,
      functionName: "tokenURI",
      args: [tid],
    }));
  }, [licenseTokenIds, licenseNftAddress]);

  const { data: licenseUris } = useReadContracts({
    contracts: licenseUriQueries,
    query: { enabled: licenseUriQueries.length > 0 },
  });

  useEffect(() => {
    const fetchMeta = async () => {
      if (!address) {
        setOwnedLicenses([]);
        return;
      }
      if (!licenseTokenIds || !licenseUris) {
        setOwnedLicenses([]);
        return;
      }
      setLoadingLicenses(true);
      setLicenseError(null);
      try {
        const metaArr: {
          tokenId: bigint;
          name?: string;
          description?: string;
          licenseType?: string;
          offerId?: string;
          assetId?: string;
          uri?: string;
          image?: string;
        }[] = [];

        for (let i = 0; i < (licenseTokenIds as bigint[]).length; i++) {
          const tid = (licenseTokenIds as bigint[])[i];
          const uriResult = licenseUris[i];
          if (!uriResult || uriResult.status !== "success") continue;
          const rawUri = uriResult.result as string;
          let meta;
          const gateways = ipfsHttpGateways(rawUri);
          for (const g of gateways) {
            try {
              const r = await fetch(g);
              if (!r.ok) continue;
              meta = await r.json();
              break;
            } catch {
              continue;
            }
          }
          metaArr.push({
            tokenId: tid,
            name: meta?.name,
            description: meta?.description,
            licenseType: meta?.attributes?.find?.((a: any) => a.trait_type === "licenseType")?.value || meta?.licenseType,
            offerId: meta?.attributes?.find?.((a: any) => a.trait_type === "offerId")?.value,
            assetId: meta?.attributes?.find?.((a: any) => a.trait_type === "assetId")?.value,
            uri: rawUri,
            image: meta?.image,
          });
        }
        setOwnedLicenses(metaArr);
      } catch (err: any) {
        setLicenseError(err?.message || "Failed to load license metadata");
        setOwnedLicenses([]);
      } finally {
        setLoadingLicenses(false);
      }
    };
    fetchMeta();
  }, [licenseTokenIds, licenseUris, address]);

  // Fractional token metadata
  const [holdingApiMeta, setHoldingApiMeta] = useState<Record<number, { ftName?: string; ftSymbol?: string }>>({});

  const erc20MetaQueries = useMemo(() => {
    if (!fractionalHoldings || fractionalHoldings.length === 0) return [];
    return fractionalHoldings.flatMap((holding) => [
      {
        address: holding.ftAddress as `0x${string}`,
        abi: ERC20_ABI as any,
        functionName: "name",
      },
      {
        address: holding.ftAddress as `0x${string}`,
        abi: ERC20_ABI as any,
        functionName: "symbol",
      },
    ]);
  }, [fractionalHoldings]);

  const { data: erc20MetaData } = useReadContracts({
    contracts: erc20MetaQueries,
    query: { enabled: erc20MetaQueries.length > 0 },
  });

  const holdingMetaMap = useMemo(() => {
    if (!erc20MetaData || fractionalHoldings.length === 0) return {};
    const map: Record<number, { name?: string; symbol?: string }> = {};
    for (let i = 0; i < erc20MetaData.length; i += 2) {
      const holdingIndex = Math.floor(i / 2);
      const nameEntry = erc20MetaData[i];
      const symbolEntry = erc20MetaData[i + 1];
      const holding = fractionalHoldings[holdingIndex];
      if (!holding) continue;
      map[holding.id] = {
        name: nameEntry && nameEntry.status === "success" ? (nameEntry.result as string) : undefined,
        symbol: symbolEntry && symbolEntry.status === "success" ? (symbolEntry.result as string) : undefined,
      };
    }
    return map;
  }, [erc20MetaData, fractionalHoldings]);

  useEffect(() => {
    const fetchApiMeta = async () => {
      if (fractionalHoldings.length === 0) {
        setHoldingApiMeta({});
        return;
      }
      const next: Record<number, { ftName?: string; ftSymbol?: string }> = {};
      await Promise.all(
        fractionalHoldings.map(async (h) => {
          try {
            const res = await fetch(`/api/token/details?ftAddress=${h.ftAddress}&poolId=${h.id}`);
            if (!res.ok) return;
            const data = await res.json();
            next[h.id] = {
              ftName: data.ftName ?? undefined,
              ftSymbol: data.ftSymbol ?? undefined,
            };
          } catch {
            // ignore individual fetch errors
          }
        })
      );
      setHoldingApiMeta(next);
    };
    fetchApiMeta();
  }, [fractionalHoldings]);

  // Claimable dividends
  const { writeContract, data: claimHash, error: claimError } = useWriteContract();
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });

  const claimableQueries = useMemo(() => {
    if (!fractionalizerAddress || !address || fractionalHoldings.length === 0) return [];
    return fractionalHoldings.map((holding) => ({
      address: fractionalizerAddress,
      abi: FractionalizerABI as any,
      functionName: "claimableAmount",
      args: [BigInt(holding.id), address],
    }));
  }, [fractionalizerAddress, address, fractionalHoldings]);

  const { data: claimableData, isLoading: claimableLoading, refetch: refetchClaimables } = useReadContracts({
    contracts: claimableQueries,
    query: { enabled: claimableQueries.length > 0 },
  });

  const claimableMap = useMemo(() => {
    if (!claimableData) return {};
    const map: Record<number, bigint> = {};
    claimableData.forEach((entry, idx) => {
      if (!entry || entry.status !== "success") return;
      const holding = fractionalHoldings[idx];
      if (holding) map[holding.id] = entry.result as bigint;
    });
    return map;
  }, [claimableData, fractionalHoldings]);

  const totalClaimable = useMemo(() => {
    return Object.values(claimableMap).reduce((acc, amt) => acc + amt, 0n);
  }, [claimableMap]);

  const handleClaim = (poolId: number) => {
    writeContract({
      address: fractionalizerAddress!,
      abi: FractionalizerABI,
      functionName: "claimDividends",
      args: [BigInt(poolId)],
    });
  };

  useEffect(() => {
    if (claimSuccess) {
      refetchClaimables();
    }
  }, [claimSuccess, refetchClaimables]);

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
        <MarketplaceNav />

        <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
            <p className="text-gray-400">Manage your assets, licenses, and fractional holdings.</p>
          </div>

          {!isConnected ? (
            <div className="max-w-md mx-auto bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-300 mb-6">Connect your wallet to view your portfolio.</p>
              <ConnectButton />
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-2 inline-flex gap-2">
                <button
                  onClick={() => setActiveTab("myAssets")}
                  className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === "myAssets"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  My Assets
                </button>
                <button
                  onClick={() => setActiveTab("licenses")}
                  className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === "licenses"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  Licenses Owned
                </button>
                <button
                  onClick={() => setActiveTab("fractional")}
                  className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === "fractional"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  Fractional Tokens
                </button>
              </div>

              {/* My Assets Tab */}
              {activeTab === "myAssets" && (
                <div className="space-y-6">
                  {/* Category Filter */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => setAssetCategory("all")}
                        className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                          assetCategory === "all"
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                            : "bg-gray-800/70 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700"
                        }`}
                      >
                        All Assets
                      </button>
                      <button
                        onClick={() => setAssetCategory("3d")}
                        className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                          assetCategory === "3d"
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                            : "bg-gray-800/70 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700"
                        }`}
                      >
                        3D Models
                      </button>
                      <button
                        onClick={() => setAssetCategory("image")}
                        className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                          assetCategory === "image"
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                            : "bg-gray-800/70 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700"
                        }`}
                      >
                        Images
                      </button>
                      <button
                        onClick={() => setAssetCategory("audio")}
                        className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                          assetCategory === "audio"
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                            : "bg-gray-800/70 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700"
                        }`}
                      >
                        Audio
                      </button>
                    </div>
                  </div>

                  {/* Assets Grid */}
                  {categorizedAssets[assetCategory].length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
                        <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-300 mb-2">No Assets Yet</h3>
                      <p className="text-gray-500 mb-6">You haven't registered any {assetCategory === "all" ? "" : assetCategory} assets yet.</p>
                      <Link
                        href="/create"
                        className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all"
                      >
                        List Your First Asset
                      </Link>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categorizedAssets[assetCategory].map((asset) => {
                        const meta = assetMetadata[asset.assetId];
                        const mimeType = meta?.properties?.mimeType || "";
                        const imageUrl = meta?.image;

                        return (
                          <div
                            key={asset.assetId}
                            className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/30 transition-all"
                          >
                            {/* Asset Image/Preview */}
                            {imageUrl && (
                              <div className="aspect-video bg-gradient-to-br from-gray-950 to-gray-900 overflow-hidden relative">
                                <AssetMedia
                                  src={imageUrl}
                                  alt={meta?.name || `Asset #${asset.assetId}`}
                                  mimeType={mimeType}
                                  filename={meta?.properties?.filename}
                                  interactive={false}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            {/* Asset Info */}
                            <div className="p-5 space-y-3">
                              <div>
                                <h3 className="text-lg font-bold text-white mb-1">
                                  {meta?.name || `Asset #${asset.assetId}`}
                                </h3>
                                {meta?.description && (
                                  <p className="text-sm text-gray-400 line-clamp-2">{meta.description}</p>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-gray-800/50 rounded-lg p-2">
                                  <p className="text-gray-500">Asset ID</p>
                                  <p className="text-white font-semibold">#{asset.assetId}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-2">
                                  <p className="text-gray-500">Royalty</p>
                                  <p className="text-white font-semibold">{(Number(asset.defaultRoyaltyBPS) / 100).toFixed(1)}%</p>
                                </div>
                              </div>

                              <Link
                                href={`/marketplace`}
                                className="block w-full py-2 text-center bg-gray-800/50 hover:bg-purple-600/20 border border-gray-700 hover:border-purple-500/50 rounded-lg text-sm font-medium transition-all"
                              >
                                View in Marketplace
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Licenses Owned Tab */}
              {activeTab === "licenses" && (
                <div className="space-y-6">
                  {loadingLicenses || loadingLicenseIds ? (
                    <div className="text-center py-20">
                      <div className="inline-block w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                      <p className="text-gray-400 text-lg">Loading licenses...</p>
                    </div>
                  ) : licenseError ? (
                    <div className="text-center py-20">
                      <p className="text-red-400">{licenseError}</p>
                    </div>
                  ) : ownedLicenses.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
                        <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-300 mb-2">No Licenses Yet</h3>
                      <p className="text-gray-500 mb-6">You haven't purchased any licenses yet.</p>
                      <Link
                        href="/marketplace"
                        className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all"
                      >
                        Browse Marketplace
                      </Link>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {ownedLicenses.map((license) => {
                        const tokenIdStr = license.tokenId ? license.tokenId.toString() : "";

                        return (
                          <div
                            key={tokenIdStr}
                            className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/30 transition-all"
                          >
                            {/* License Image */}
                            {license.image && (
                              <div className="aspect-video bg-gradient-to-br from-gray-950 to-gray-900 overflow-hidden relative">
                                <AssetMedia
                                  src={license.image}
                                  alt={license.name || `License #${tokenIdStr}`}
                                  interactive={false}
                                  className="w-full h-full object-cover"
                                />
                                {/* License Type Badge */}
                                <div className="absolute top-3 right-3">
                                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/90 text-white backdrop-blur-sm">
                                    {license.licenseType || "LICENSE"}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* License Info */}
                            <div className="p-5 space-y-3">
                              <div>
                                <h3 className="text-lg font-bold text-white mb-1">
                                  {license.name || `License #${tokenIdStr}`}
                                </h3>
                                {license.description && (
                                  <p className="text-sm text-gray-400 line-clamp-2">{license.description}</p>
                                )}
                              </div>

                              <div className="bg-gray-800/50 rounded-lg p-3">
                                <p className="text-xs text-gray-500 mb-1">Token ID</p>
                                <p className="text-sm text-white font-mono">{tokenIdStr}</p>
                              </div>

                              {license.image && (
                                <a
                                  href={`/api/download-asset?url=${encodeURIComponent(license.image)}&filename=license-asset`}
                                  download
                                  className="block w-full py-2 text-center bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600 hover:to-pink-600 border border-purple-500/30 hover:border-purple-500 rounded-lg text-sm font-semibold transition-all"
                                >
                                  Download Asset
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Fractional Tokens Tab */}
              {activeTab === "fractional" && (
                <div className="space-y-6">
                  {/* Total Claimable */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <p className="text-gray-400 text-sm mb-2">Total Claimable Royalty</p>
                    <p className="text-3xl font-bold text-white">
                      {claimableLoading
                        ? "Loading..."
                        : `${Number(formatUnits(totalClaimable, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} IP`}
                    </p>
                  </div>

                  {fractionalHoldings.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
                        <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-300 mb-2">No Fractional Tokens</h3>
                      <p className="text-gray-500 mb-6">You don't hold any fractional tokens yet.</p>
                      <Link
                        href="/pools"
                        className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all"
                      >
                        Browse Primary Market
                      </Link>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {fractionalHoldings.map((p) => {
                        const chainMeta = holdingMetaMap[p.id];
                        const apiMeta = holdingApiMeta[p.id];
                        const displayName = chainMeta?.name || apiMeta?.ftName || `Pool #${p.id}`;
                        const displaySymbol = chainMeta?.symbol || apiMeta?.ftSymbol;
                        const claimable = claimableMap[p.id] || 0n;

                        return (
                          <div key={p.id} className="bg-gray-800/50 rounded-lg p-4 space-y-3 hover:bg-gray-800/70 transition-colors">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-white text-sm truncate">{displayName}</h3>
                                {displaySymbol && <p className="text-xs text-gray-500 font-mono">{displaySymbol}</p>}
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${p.active ? "bg-green-500/90 text-white" : "bg-gray-700 text-gray-300"}`}>
                                {p.active ? "Active" : "Closed"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="bg-gray-900/50 rounded-lg p-2">
                                <p className="text-gray-500 text-xs mb-1">Balance</p>
                                <p className="font-semibold text-white">{Number(formatUnits(p.balance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                              </div>
                              <div className="bg-gray-900/50 rounded-lg p-2">
                                <p className="text-gray-500 text-xs mb-1">Claimable</p>
                                <p className="font-semibold text-green-400">
                                  {claimableLoading ? "..." : `${Number(formatUnits(claimable, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 })} IP`}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleClaim(p.id)}
                              disabled={claimConfirming || claimable === 0n}
                              className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-all"
                            >
                              {claimConfirming ? "Claiming..." : "Claim Royalty"}
                            </button>

                            {claimSuccess && <p className="text-xs text-green-400 text-center">Claimed successfully!</p>}
                            {claimError && getUserFriendlyError(claimError) && (
                              <p className="text-xs text-red-400 text-center truncate">
                                {getUserFriendlyError(claimError)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
