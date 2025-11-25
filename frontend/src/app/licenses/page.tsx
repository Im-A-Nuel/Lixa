"use client";

import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import Link from "next/link";
import { formatEther, parseEther } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import LicenseManagerABI from "@/lib/contracts/LicenseManager.json";

export default function LicensesPage() {
  const { chainId, isConnected } = useAccount();
  const licenseManager = chainId ? getContractAddress(chainId, "LicenseManager") : undefined;

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

  const offers = useMemo(() => {
    if (!offersData) return [];
    return offersData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        const [offerId, assetId, seller, price, royaltyBPS, ltype, preset, maxSupply, sold, duration, active, uri] =
          entry.result as any;
        if (!active) return null;
        return {
          offerId: Number(offerId),
          assetId,
          seller,
          price,
          royaltyBPS,
          ltype,
          preset,
          maxSupply,
          sold,
          duration,
          uri,
        };
      })
      .filter(Boolean) as {
      offerId: number;
      assetId: bigint;
      seller: string;
      price: bigint;
      royaltyBPS: number;
      ltype: number;
      preset: number;
      maxSupply: bigint;
      sold: bigint;
      duration: bigint;
      uri: string;
    }[];
  }, [offersData]);

  const [assetIdInput, setAssetIdInput] = useState("1");
  const [priceInput, setPriceInput] = useState("0.1");
  const [royaltyInput, setRoyaltyInput] = useState("500"); // bps
  const [ltypeInput, setLtypeInput] = useState("0");
  const [presetInput, setPresetInput] = useState("0");
  const [maxSupplyInput, setMaxSupplyInput] = useState("0");
  const [durationInput, setDurationInput] = useState("0");
  const [uriInput, setUriInput] = useState("ipfs://...");

  const { writeContract, data: txHash, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleCreateOffer = () => {
    if (!licenseManager) return;
    writeContract({
      address: licenseManager,
      abi: LicenseManagerABI,
      functionName: "createOffer",
      args: [
        BigInt(assetIdInput || "0"),
        parseEther(priceInput || "0"),
        Number(royaltyInput || "0"),
        Number(ltypeInput || "0"),
        Number(presetInput || "0"),
        BigInt(maxSupplyInput || "0"),
        BigInt(durationInput || "0"),
        uriInput,
      ],
    });
  };

  const handleBuy = (offerId: number, price: bigint) => {
    if (!licenseManager) return;
    writeContract({
      address: licenseManager,
      abi: LicenseManagerABI,
      functionName: "buyLicense",
      args: [BigInt(offerId)],
      value: price,
    });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Lixa
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link href="/marketplace" className="text-gray-400 hover:text-white transition">
                Marketplace
              </Link>
              <Link href="/pools" className="text-gray-400 hover:text-white transition">
                Pools
              </Link>
              <Link href="/fractionalize" className="text-gray-400 hover:text-white transition">
                Fractionalize
              </Link>
              <Link href="/licenses" className="text-white font-medium">
                Licenses
              </Link>
              <Link href="/create" className="text-gray-400 hover:text-white transition">
                Create
              </Link>
              <Link href="/portfolio" className="text-gray-400 hover:text-white transition">
                Portfolio
              </Link>
            </nav>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">License Market</h1>
            <p className="text-gray-400">Create and buy license offers.</p>
          </div>
          {!isConnected && <ConnectButton />}
        </div>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Create License Offer</h3>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Asset ID</label>
              <input
                type="number"
                value={assetIdInput}
                onChange={(e) => setAssetIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Price (ETH)</label>
              <input
                type="text"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Royalty BPS</label>
              <input
                type="number"
                value={royaltyInput}
                onChange={(e) => setRoyaltyInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">License Type (0=NON_EXCLUSIVE,1=EXCLUSIVE,2=DERIVATIVE)</label>
              <input
                type="number"
                value={ltypeInput}
                onChange={(e) => setLtypeInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Preset (0=IN_GAME_COMMERCIAL_V1,1=TRAILER_MARKETING_V1,2=EDU_INDIE_V1)</label>
              <input
                type="number"
                value={presetInput}
                onChange={(e) => setPresetInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Max Supply (0 = unlimited)</label>
              <input
                type="number"
                value={maxSupplyInput}
                onChange={(e) => setMaxSupplyInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Duration (seconds, 0 = permanent)</label>
              <input
                type="number"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Metadata URI</label>
              <input
                type="text"
                value={uriInput}
                onChange={(e) => setUriInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={handleCreateOffer}
              disabled={!isConnected || confirming}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
            >
              {confirming ? "Submitting..." : "Create Offer"}
            </button>
            {isSuccess && <p className="text-xs text-green-400">TX: {txHash}</p>}
            {error && <p className="text-xs text-red-400 break-all">Error: {error.message}</p>}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Active Offers</h3>
            {offers.length === 0 ? (
              <p className="text-gray-400">No active license offers.</p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-auto pr-2">
                {offers.map((o) => (
                  <div key={o.offerId} className="border border-gray-800 rounded p-3 space-y-2">
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Offer #{o.offerId}</span>
                      <span>Asset #{o.assetId.toString()}</span>
                    </div>
                    <p className="text-sm text-gray-400">Price: {formatEther(o.price)} ETH</p>
                    <p className="text-sm text-gray-400">Max supply: {o.maxSupply.toString() === "0" ? "Unlimited" : o.maxSupply.toString()}</p>
                    <p className="text-sm text-gray-400">Sold: {o.sold.toString()}</p>
                    <p className="text-sm text-gray-400 break-all">URI: {o.uri}</p>
                    <button
                      onClick={() => handleBuy(o.offerId, o.price)}
                      disabled={!isConnected}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition text-sm"
                    >
                      Buy License
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
