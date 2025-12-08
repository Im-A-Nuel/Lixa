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
];

export default function PortfolioPage() {
  const { address, chainId, isConnected } = useAccount();
  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;
  const licenseNftAddress = chainId ? getContractAddress(chainId, "LicenseNFT") : undefined;
  const licenseManagerAddress = chainId ? getContractAddress(chainId, "LicenseManager") : undefined;
  const [ownedLicenses, setOwnedLicenses] = useState<
    { tokenId: bigint; name?: string; description?: string; licenseType?: string; offerId?: string; assetId?: string; uri?: string; image?: string }
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

        for (let i = 0; i < licenseTokenIds.length; i++) {
          const tid = licenseTokenIds[i] as bigint;
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

  // Removed off-chain license fetch; list is derived from on-chain LicenseNFT ownership

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

  return (
    <div className="min-h-screen text-white">
      <MarketplaceNav />

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Portfolio</h1>
          <p className="text-gray-400">Your registered assets and fractional token balances.</p>
        </div>

        {!isConnected ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to view your portfolio.</p>
            <ConnectButton />
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Registered Assets</h2>
              {registeredAssets.length === 0 ? (
                <p className="text-gray-400">No assets registered by this wallet.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {registeredAssets.map((a, idx) => (
                    <div key={idx} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-gray-400 break-all">Metadata: {a.metadataURI}</p>
                      <p className="text-sm text-gray-400 break-all">NFT: {a.nftContract} #{a.tokenId.toString()}</p>
                      <p className="text-sm text-gray-400">Royalty: {(Number(a.defaultRoyaltyBPS) / 100).toFixed(2)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Licenses Owned</h2>
              {loadingLicenses || loadingLicenseIds ? (
                <p className="text-gray-400">Loading licenses...</p>
              ) : licenseError ? (
                <p className="text-red-400 text-sm">{licenseError}</p>
              ) : ownedLicenses.length === 0 ? (
                <p className="text-gray-400">No licenses purchased.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownedLicenses.map((l) => {
                    const tokenIdStr = l.tokenId ? l.tokenId.toString() : "";
                    return (
                      <div key={tokenIdStr} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-gray-300 font-semibold">{l.name || `License #${tokenIdStr}`}</p>
                            <p className="text-xs text-gray-500">Token ID: {tokenIdStr}</p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-300">
                            {l.licenseType || "LICENSE"}
                          </span>
                        </div>
                        {l.assetId && <p className="text-xs text-gray-400">Asset ID: {l.assetId}</p>}
                        {l.offerId && <p className="text-xs text-gray-400">Offer ID: {l.offerId}</p>}
                        {l.description && <p className="text-sm text-gray-400 line-clamp-3">{l.description}</p>}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {l.uri && (
                            <a
                              href={ipfsHttpGateways(l.uri)[0]}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 bg-gray-800 text-purple-300 rounded"
                            >
                              Open license metadata
                            </a>
                          )}
                          {l.assetId && assetMediaMap[Number(l.assetId)]?.metadataURI && (
                            <a
                              href={ipfsHttpGateways(assetMediaMap[Number(l.assetId)].metadataURI!)[0]}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 bg-gray-800 text-purple-300 rounded"
                            >
                              Open asset metadata
                            </a>
                          )}
                          {(() => {
                            const data =
                              (l.assetId && assetMediaMap[Number(l.assetId)]) || (l.image ? { image: l.image } : null);
                            if (!data?.image) return null;
                            const imageCid = data.image;
                            const rawName =
                              data.filename ||
                              imageCid.split("/").pop()?.split("?")[0] ||
                              "asset";
                            const nameWithExt = rawName.includes(".")
                              ? rawName
                              : (data.mimeType && data.mimeType.includes("gltf")) ? `${rawName}.glb` : `${rawName}.glb`;
                            const downloadUrl = `/api/download-asset?url=${encodeURIComponent(imageCid)}&filename=${encodeURIComponent(
                              nameWithExt
                            )}`;
                            return (
                              <a
                                href={downloadUrl}
                                className="px-2 py-1 bg-gray-800 text-purple-300 rounded"
                              >
                                Download asset
                              </a>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Fractional Tokens Held</h2>
              <div className="text-sm text-gray-300">
                Total claimable royalty:{" "}
                {claimableLoading
                  ? "Loading..."
                  : `${Number(formatUnits(totalClaimable, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`}
              </div>
              {fractionalHoldings.length === 0 ? (
                <p className="text-gray-400">No fractional token balance.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fractionalHoldings.map((p) => {
                    const chainMeta = holdingMetaMap[p.id];
                    const apiMeta = holdingApiMeta[p.id];
                    const displayName = chainMeta?.name || apiMeta?.ftName || `Pool #${p.id}`;
                    const displaySymbol = chainMeta?.symbol || apiMeta?.ftSymbol;
                    return (
                      <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold">{displayName}</h3>
                            {displaySymbol && <p className="text-xs text-gray-400">{displaySymbol}</p>}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${p.active ? "bg-green-900/40 text-green-400" : "bg-gray-800 text-gray-400"}`}>
                            {p.active ? "Active" : "Closed"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 break-all">FT: {p.ftAddress}</p>
                        <p className="text-sm text-gray-400 break-all">NFT: {p.nftContract} #{p.tokenId.toString()}</p>
                        <p className="text-sm text-gray-400">Balance: {formatUnits(p.balance, 18)} tokens</p>
                        <p className="text-sm text-gray-400">Sold: {formatUnits(p.sold, 18)} / {formatUnits(p.totalFractions, 18)}</p>
                        <p className="text-sm text-gray-300">
                          Claimable royalty:{" "}
                          {claimableLoading
                            ? "Loading..."
                            : `${Number(formatUnits(claimableMap[p.id] || 0n, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`}
                        </p>
                        <button
                          onClick={() => handleClaim(p.id)}
                          disabled={claimConfirming || (claimableMap[p.id] || 0n) === 0n}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition text-sm"
                        >
                          {claimConfirming ? "Claiming..." : "Claim Royalties"}
                        </button>
                        {claimSuccess && <p className="text-xs text-green-400">Claim sent: {claimHash}</p>}
                        {claimError && <p className="text-xs text-red-400 break-all">Error: {claimError.message}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
