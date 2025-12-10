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

export default function PortfolioPage() {
  const { address, chainId, isConnected } = useAccount();
  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;
  const licenseNftAddress = chainId ? getContractAddress(chainId, "LicenseNFT") : undefined;
  const licenseManagerAddress = chainId ? getContractAddress(chainId, "LicenseManager") : undefined;
  const [ownedLicenses, setOwnedLicenses] = useState<
    { tokenId: bigint; name?: string; description?: string; licenseType?: string; offerId?: string; assetId?: string; uri?: string; image?: string }[]
  >([]);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);

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
      abi: AssetRegistryABI,
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
      .map((entry) => {
        if (!entry || entry.status !== "success") return null;
        const a: any = entry.result;
        if (!a?.exists) return null;
        if (a.creator.toLowerCase() !== address.toLowerCase()) return null;
        return a;
      })
      .filter(Boolean) as any[];
  }, [assetsData, address]);

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
      abi: FractionalizerABI,
      functionName: "poolInfo",
      args: [BigInt(idx + 1)],
    }));
  }, [fractionalizerAddress, totalPools]);

  const { data: poolData } = useReadContracts({
    contracts: poolQueries,
    query: { enabled: poolQueries.length > 0 },
  });

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
      abi: LicenseNFTABI.abi,
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

  // Fetch asset details for licenses (to get asset metadata URI for download)
  const licenseOfferIds = useMemo(() => {
    return Array.from(
      new Set(
        ownedLicenses
          .map((l) => (l.offerId ? Number(l.offerId) : null))
          .filter((v): v is number => v !== null && !Number.isNaN(v))
      )
    );
  }, [ownedLicenses]);

  const offerQueries = useMemo(() => {
    if (!licenseManagerAddress || licenseOfferIds.length === 0) return [];
    return licenseOfferIds.map((oid) => ({
      address: licenseManagerAddress,
      abi: LicenseManagerABI,
      functionName: "offers",
      args: [BigInt(oid)],
    }));
  }, [licenseManagerAddress, licenseOfferIds]);

  const { data: offerData } = useReadContracts({
    contracts: offerQueries,
    query: { enabled: offerQueries.length > 0 },
  });

  const offerAssetMap = useMemo(() => {
    if (!offerData) return {};
    const map: Record<number, number> = {};
    offerData.forEach((entry, idx) => {
      if (!entry || entry.status !== "success") return;
      const oid = licenseOfferIds[idx];
      const offer: any = entry.result;
      const assetId = Number(offer[1]);
      if (!Number.isNaN(assetId)) map[oid] = assetId;
    });
    return map;
  }, [offerData, licenseOfferIds]);

  const licenseAssetIds = useMemo(() => {
    return Array.from(
      new Set(
        ownedLicenses
          .map((l) => {
            if (l.assetId) return Number(l.assetId);
            if (l.offerId && offerAssetMap[Number(l.offerId)]) return offerAssetMap[Number(l.offerId)];
            return null;
          })
          .filter((v): v is number => v !== null && !Number.isNaN(v))
      )
    );
  }, [ownedLicenses, offerAssetMap]);

  const assetDetailQueries = useMemo(() => {
    if (!registryAddress || licenseAssetIds.length === 0) return [];
    return licenseAssetIds.map((aid) => ({
      address: registryAddress,
      abi: AssetRegistryABI,
      functionName: "getAsset",
      args: [BigInt(aid)],
    }));
  }, [registryAddress, licenseAssetIds]);

  const { data: assetDetailsData } = useReadContracts({
    contracts: assetDetailQueries,
    query: { enabled: assetDetailQueries.length > 0 },
  });

  const [assetMediaMap, setAssetMediaMap] = useState<Record<number, { metadataURI?: string; image?: string; filename?: string; mimeType?: string }>>({});

  useEffect(() => {
    const fetchAssets = async () => {
      if (!assetDetailsData) return;
      const next: Record<number, { metadataURI?: string; image?: string; filename?: string; mimeType?: string }> = {};

      for (let i = 0; i < assetDetailsData.length; i++) {
        const entry = assetDetailsData[i];
        if (!entry || entry.status !== "success") continue;
        const assetId = licenseAssetIds[i];
        const asset: any = entry.result;
        const metadataURI = asset?.metadataURI as string | undefined;
        next[assetId] = { metadataURI };
        if (metadataURI) {
          const gateways = ipfsHttpGateways(metadataURI);
          for (const g of gateways) {
            try {
              const res = await fetch(g);
              if (!res.ok) continue;
              const json = await res.json();
              next[assetId].image = json?.image;
              next[assetId].filename = json?.properties?.filename || json?.filename;
              next[assetId].mimeType = json?.properties?.mimeType || json?.mimeType;
              break;
            } catch {
              continue;
            }
          }
        }
      }

      setAssetMediaMap(next);
    };
    fetchAssets();
  }, [assetDetailsData, licenseAssetIds]);

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

  const { writeContract, data: claimHash, error: claimError } = useWriteContract();
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });

  const claimableQueries = useMemo(() => {
    if (!fractionalizerAddress || !address || fractionalHoldings.length === 0) return [];
    return fractionalHoldings.map((holding) => ({
      address: fractionalizerAddress,
      abi: FractionalizerABI,
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

  const [holdingApiMeta, setHoldingApiMeta] = useState<Record<number, { ftName?: string; ftSymbol?: string }>>({});

  const erc20MetaQueries = useMemo(() => {
    if (!fractionalHoldings || fractionalHoldings.length === 0) return [];
    return fractionalHoldings.flatMap((holding) => [
      {
        address: holding.ftAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "name",
      },
      {
        address: holding.ftAddress as `0x${string}`,
        abi: ERC20_ABI,
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

  // Card wrapper component with gradient border
  const GradientCard = ({ children, className = "", gradient = "cyan" }: { children: React.ReactNode; className?: string; gradient?: "cyan" | "purple" | "mixed" }) => {
    const gradientStyles = {
      cyan: "from-cyan-500/50 via-cyan-400/30 to-cyan-500/50",
      purple: "from-purple-500/50 via-pink-400/30 to-purple-500/50",
      mixed: "from-cyan-500/50 via-purple-400/30 to-pink-500/50",
    };

    return (
      <div className={`relative group ${className}`}>
        {/* Gradient border glow */}
        <div className={`absolute -inset-[1px] bg-gradient-to-r ${gradientStyles[gradient]} rounded-xl blur-sm opacity-75 group-hover:opacity-100 transition-opacity`} />
        {/* Card content */}
        <div className="relative bg-gray-900/95 backdrop-blur-sm rounded-xl border border-gray-800/50">
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Portfolio</h1>
          <p className="text-gray-400">Your registered assets and fractional token balances.</p>
        </div>

        {!isConnected ? (
          <GradientCard gradient="mixed" className="max-w-md mx-auto">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-300 mb-6">Connect your wallet to view your portfolio.</p>
              <ConnectButton />
            </div>
          </GradientCard>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Registered Assets Card */}
            <GradientCard gradient="cyan">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold">Registered Assets</h2>
                  </div>
                  <Link href="/marketplace" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors">
                    View All
                  </Link>
                </div>

                <div className="text-5xl font-bold mb-4 text-white">
                  {registeredAssets.length}
                </div>

                {registeredAssets.length === 0 ? (
                  <p className="text-gray-500 text-sm">No assets registered by this wallet.</p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-auto">
                    {registeredAssets.slice(0, 3).map((a, idx) => (
                      <div key={idx} className="bg-gray-800/50 rounded-lg p-3 text-sm">
                        <p className="text-gray-300 truncate">NFT: {a.nftContract.slice(0, 10)}...#{a.tokenId.toString()}</p>
                        <p className="text-gray-500 text-xs">Royalty: {(Number(a.defaultRoyaltyBPS) / 100).toFixed(2)}%</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GradientCard>

            {/* Licenses Owned Card */}
            <GradientCard gradient="purple">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold">Licenses Owned</h2>
                  </div>
                </div>

                {loadingLicenses || loadingLicenseIds ? (
                  <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span>Loading licenses...</span>
                  </div>
                ) : licenseError ? (
                  <p className="text-red-400 text-sm">{licenseError}</p>
                ) : ownedLicenses.length === 0 ? (
                  <div>
                    <p className="text-5xl font-bold mb-4">0</p>
                    <p className="text-gray-500 text-sm">No licenses purchased.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-5xl font-bold mb-4">{ownedLicenses.length}</p>
                    <div className="space-y-3 max-h-48 overflow-auto">
                      {ownedLicenses.slice(0, 3).map((l) => {
                        const tokenIdStr = l.tokenId ? l.tokenId.toString() : "";
                        const data =
                          (l.assetId && assetMediaMap[Number(l.assetId)]) || (l.image ? { image: l.image } : null);
                        return (
                          <div key={tokenIdStr} className="bg-gray-800/50 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-gray-300 text-sm font-medium">{l.name || `License #${tokenIdStr}`}</p>
                                <p className="text-gray-500 text-xs">Token ID: {tokenIdStr}</p>
                              </div>
                              <span className="text-xs px-2 py-1 rounded bg-purple-900/50 text-purple-300">
                                {l.licenseType || "LICENSE"}
                              </span>
                            </div>
                            {data?.image && (
                              <div className="mt-2 flex gap-2">
                                <a
                                  href={`/api/download-asset?url=${encodeURIComponent(data.image)}&filename=asset`}
                                  className="text-xs text-purple-400 hover:text-purple-300"
                                >
                                  Download asset
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </GradientCard>

            {/* Fractional Tokens Held - Full Width */}
            <GradientCard gradient="mixed" className="lg:col-span-2">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold">Fractional Tokens Held</h2>
                  </div>
                  <Link href="/secondary-market" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors">
                    View Details
                  </Link>
                </div>

                {/* Total Claimable */}
                <div className="mb-6">
                  <p className="text-gray-400 text-sm mb-1">Total claimable royalty:</p>
                  <p className="text-3xl font-bold text-white">
                    {claimableLoading
                      ? "Loading..."
                      : `${Number(formatUnits(totalClaimable, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`}
                  </p>
                </div>

                {fractionalHoldings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No fractional token balance.</p>
                    <Link href="/pools" className="inline-block mt-4 text-cyan-400 hover:text-cyan-300 text-sm">
                      Browse Primary Market →
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
                        <div key={p.id} className="bg-gray-800/50 rounded-xl p-4 space-y-3 hover:bg-gray-800/70 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-white">{displayName}</h3>
                              {displaySymbol && <p className="text-xs text-gray-500">{displaySymbol}</p>}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${p.active ? "bg-green-900/40 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                              {p.active ? "Active" : "Closed"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-gray-900/50 rounded-lg p-2">
                              <p className="text-gray-500 text-xs">Balance</p>
                              <p className="font-medium">{Number(formatUnits(p.balance, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-2">
                              <p className="text-gray-500 text-xs">Claimable</p>
                              <p className="font-medium text-green-400">
                                {claimableLoading ? "..." : `${Number(formatUnits(claimable, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleClaim(p.id)}
                            disabled={claimConfirming || claimable === 0n}
                            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition text-sm"
                          >
                            {claimConfirming ? "Claiming..." : "Claim"}
                          </button>

                          {claimSuccess && <p className="text-xs text-green-400 text-center">Claimed successfully!</p>}
                          {claimError && <p className="text-xs text-red-400 text-center truncate">Error: {claimError.message}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </GradientCard>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
