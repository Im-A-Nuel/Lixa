"use client";

import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import LicenseManagerABI from "@/lib/contracts/LicenseManager.json";
import { MarketplaceNav } from "@/components/MarketplaceNav";

export default function LicensesPage() {
  const { chainId, isConnected } = useAccount();
  const licenseManager = chainId ? getContractAddress(chainId, "LicenseManager") : undefined;

  const { data: totalOffers } = useReadContract({
    address: licenseManager,
    abi: LicenseManagerABI,
    functionName: "totalOffers",
  });

  const offerQueries = useMemo(() => {
    if (!licenseManager || !totalOffers || totalOffers === BigInt(0)) return [];
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

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");
  const [assetIdInput, setAssetIdInput] = useState("1");
  const [priceInput, setPriceInput] = useState("0.1");
  const [royaltyInput, setRoyaltyInput] = useState("500"); // bps
  const [ltypeInput, setLtypeInput] = useState("0");
  const [presetInput, setPresetInput] = useState("0");
  const [maxSupplyInput, setMaxSupplyInput] = useState("0");
  const [durationInput, setDurationInput] = useState("0");
  const [uriInput, setUriInput] = useState("ipfs://...");

  const filteredOffers = useMemo(() => {
    let filtered = offers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((offer) => {
        return (
          offer.offerId.toString().includes(query) ||
          offer.assetId.toString().includes(query) ||
          offer.seller.toLowerCase().includes(query) ||
          formatEther(offer.price).includes(query)
        );
      });
    }

    // Apply sorting
    const sorted = [...filtered];
    if (sortBy === "highest") {
      sorted.sort((a, b) => Number(b.price - a.price));
    } else if (sortBy === "lowest") {
      sorted.sort((a, b) => Number(a.price - b.price));
    } else {
      sorted.sort((a, b) => b.offerId - a.offerId); // newest first
    }

    return sorted;
  }, [offers, searchQuery, sortBy]);

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
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

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
              <label className="block text-sm text-gray-400">Price (IP)</label>
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
              <label className="block text-sm text-gray-400 mb-3">License Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLtypeInput("0")}
                  className={`px-3 py-3 rounded-lg border-2 transition-all ${
                    ltypeInput === "0"
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-xs font-semibold">NON-EXCLUSIVE</div>
                  <div className="text-[10px] mt-1 opacity-70">Multiple buyers</div>
                </button>
                <button
                  type="button"
                  onClick={() => setLtypeInput("1")}
                  className={`px-3 py-3 rounded-lg border-2 transition-all ${
                    ltypeInput === "1"
                      ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-xs font-semibold">EXCLUSIVE</div>
                  <div className="text-[10px] mt-1 opacity-70">Single buyer</div>
                </button>
                <button
                  type="button"
                  onClick={() => setLtypeInput("2")}
                  className={`px-3 py-3 rounded-lg border-2 transition-all ${
                    ltypeInput === "2"
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-xs font-semibold">DERIVATIVE</div>
                  <div className="text-[10px] mt-1 opacity-70">Modifiable</div>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-400 mb-3">License Preset</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setPresetInput("0")}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    presetInput === "0"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-sm font-semibold">In-Game Commercial V1</div>
                  <div className="text-xs mt-1 opacity-70">For commercial game usage</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPresetInput("1")}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    presetInput === "1"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-sm font-semibold">Trailer & Marketing V1</div>
                  <div className="text-xs mt-1 opacity-70">For promotional content</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPresetInput("2")}
                  className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                    presetInput === "2"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-sm font-semibold">Educational & Indie V1</div>
                  <div className="text-xs mt-1 opacity-70">For educational/indie projects</div>
                </button>
              </div>
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

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Active Offers</h3>

            {/* Search and Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              {/* Search Input */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Offers
                </label>
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-900/80 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm placeholder-gray-500"
                />
              </div>

              {/* Sort By Dropdown */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-gray-900/80 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="highest">Highest Price</option>
                  <option value="lowest">Lowest Price</option>
                </select>
              </div>

              {/* Total Offers Card */}
              <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Total Offers
                </div>
                <div className="text-3xl font-bold text-white">{filteredOffers.length}</div>
              </div>
            </div>

            {filteredOffers.length === 0 ? (
              <p className="text-gray-400">{searchQuery ? "No offers found matching your search." : "No active license offers."}</p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-auto pr-2">
                {filteredOffers.map((o) => (
                  <div key={o.offerId} className="border border-gray-800 rounded p-3 space-y-2">
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Offer #{o.offerId}</span>
                      <span>Asset #{o.assetId.toString()}</span>
                    </div>
                    <p className="text-sm text-gray-400">Price: {formatEther(o.price)} IP</p>
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
    </div>
  );
}
