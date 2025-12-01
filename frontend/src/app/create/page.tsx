"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi";
import { useMemo, useState } from "react";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import LicenseManagerABI from "@/lib/contracts/LicenseManager.json";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import { parseEther, parseUnits } from "viem";
import { MarketplaceNav } from "@/components/MarketplaceNav";

const ERC721_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getApproved",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
];

export default function CreatePage() {
  const { isConnected, chainId } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [royaltyBPS, setRoyaltyBPS] = useState("500"); // 5%
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [assetIdForOffer, setAssetIdForOffer] = useState("");
  const [priceEth, setPriceEth] = useState("0.1");
  const [royaltyOfferBps, setRoyaltyOfferBps] = useState("500"); // 5%
  const [ltype, setLtype] = useState("0");
  const [preset, setPreset] = useState("0");
  const [maxSupply, setMaxSupply] = useState("0"); // 0 = unlimited
  const [duration, setDuration] = useState("0"); // 0 = permanent
  const [uriOffer, setUriOffer] = useState("");
  const [offerMessage, setOfferMessage] = useState<string | null>(null);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const {
    writeContract: writeOffer,
    data: offerHash,
    isPending: offerPending,
    error: offerError,
  } = useWriteContract();
  const { isLoading: offerConfirming, isSuccess: offerSuccess } = useWaitForTransactionReceipt({ hash: offerHash });

  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;
  const licenseManager = chainId ? getContractAddress(chainId, "LicenseManager") : undefined;
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;
  const publicClient = usePublicClient();

  // Fractionalize states
  const [assetIdInput, setAssetIdInput] = useState("1");
  const assetId = assetIdInput ? BigInt(assetIdInput) : undefined;
  const [ftName, setFtName] = useState("Fractional Asset");
  const [ftSymbol, setFtSymbol] = useState("FRAC");
  const [totalSupply, setTotalSupply] = useState("1000");
  const [amountForSale, setAmountForSale] = useState("500");
  const [pricePerToken, setPricePerToken] = useState("0.001");
  const [actionHash, setActionHash] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "approving" | "fractionalizing" | "approvingSale" | "done">("idle");

  const { data: asset, isLoading: loadingAsset } = useReadContract({
    address: registryAddress,
    abi: AssetRegistryABI,
    functionName: "getAsset",
    args: assetId ? [assetId] : undefined,
    query: { enabled: Boolean(registryAddress && assetId) },
  });

  const { data: currentApproval } = useReadContract({
    address: asset ? ((asset as any).nftContract as `0x${string}`) : undefined,
    abi: ERC721_APPROVE_ABI,
    functionName: "getApproved",
    args: asset ? [(asset as any).tokenId as bigint] : undefined,
    query: { enabled: Boolean(asset) },
  });

  const { writeContractAsync: writeFracAsync } = useWriteContract();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registryAddress || !file) return;

    try {
      setUploadError(null);
      setUploading(true);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name || "Asset");
      fd.append("description", description);

      const res = await fetch("/api/ipfs", {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) {
        const msg =
          typeof body?.error === "string"
            ? body.error
            : body?.error
              ? JSON.stringify(body.error)
              : "Upload failed";
        setUploadError(msg);
        setUploading(false);
        return;
      }

      const metadataURI = body.metadataUri ?? body.metadataURI;
      if (!metadataURI) {
        setUploadError("Metadata URI not returned");
        setUploading(false);
        return;
      }

      writeContract({
        address: registryAddress,
        abi: AssetRegistryABI,
        functionName: "registerAsset",
        args: [metadataURI, Number(royaltyBPS)],
      });
      // Prefill license URI with the uploaded metadata to speed up offer creation
      setUriOffer(metadataURI);
    } finally {
      setUploading(false);
    }
  };

  const canFractionalize = useMemo(() => {
    return Boolean(
      isConnected &&
        fractionalizerAddress &&
        asset &&
        (asset as any).exists &&
        assetId &&
        ftName &&
        ftSymbol &&
        totalSupply &&
        amountForSale &&
        pricePerToken
    );
  }, [isConnected, fractionalizerAddress, asset, assetId, ftName, ftSymbol, totalSupply, amountForSale, pricePerToken]);

  const handleApproveAndFractionalize = async () => {
    if (!asset || !fractionalizerAddress || !assetId) return;
    const nftContract = (asset as any).nftContract as `0x${string}`;
    const tokenId = (asset as any).tokenId as bigint;
    setActionError(undefined);
    setActionHash(undefined);
    try {
      if (!currentApproval || (typeof currentApproval === "string" && currentApproval.toLowerCase() !== fractionalizerAddress.toLowerCase())) {
        setStatus("approving");
        const approveHash = await writeFracAsync({
          address: nftContract,
          abi: ERC721_APPROVE_ABI,
          functionName: "approve",
          args: [fractionalizerAddress, tokenId],
        });
        setActionHash(approveHash as `0x${string}`);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
        }
      }

      // Fractionalize
      setStatus("fractionalizing");
      const poolsBefore =
        publicClient && fractionalizerAddress
          ? await publicClient.readContract({
              address: fractionalizerAddress,
              abi: FractionalizerABI,
              functionName: "totalPools",
            })
          : undefined;

      const totalSupplyWei = parseUnits(totalSupply || "0", 18);
      const amountForSaleWei = parseUnits(amountForSale || "0", 18);
      const pricePerTokenWei = parseEther(pricePerToken || "0");

      const fracHash = await writeFracAsync({
        address: fractionalizerAddress,
        abi: FractionalizerABI,
        functionName: "fractionalize",
        args: [
          assetId,
          nftContract,
          tokenId,
          ftName,
          ftSymbol,
          totalSupplyWei,
          pricePerTokenWei,
          amountForSaleWei,
          (asset as any).creator as `0x${string}`,
        ],
      });
      setActionHash(fracHash as `0x${string}`);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: fracHash as `0x${string}` });
      }

      // Approve sale amount
      if (publicClient && fractionalizerAddress) {
        try {
          const poolsAfter = await publicClient.readContract({
            address: fractionalizerAddress,
            abi: FractionalizerABI,
            functionName: "totalPools",
          });
          const poolId =
            poolsBefore && typeof poolsBefore === "bigint" ? poolsBefore + BigInt(1) : (poolsAfter as bigint);
          const poolInfo = (await publicClient.readContract({
            address: fractionalizerAddress,
            abi: FractionalizerABI,
            functionName: "poolInfo",
            args: [poolId],
          })) as any;
          const ftAddress = poolInfo[2] as `0x${string}`;

          setStatus("approvingSale");
          const approveSaleHash = await writeFracAsync({
            address: ftAddress,
            abi: [
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
            ],
            functionName: "approve",
            args: [fractionalizerAddress, amountForSaleWei],
          });
          setActionHash(approveSaleHash as `0x${string}`);
          await publicClient.waitForTransactionReceipt({ hash: approveSaleHash as `0x${string}` });
        } catch (err) {
          console.error("Auto-approve sale failed", err);
        }
      }

      setStatus("done");
      // Prefill assetId for license step
      setAssetIdForOffer(assetId.toString());
    } catch (err: any) {
      setActionError(err?.message || "Transaction failed");
      setStatus("idle");
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseManager) return;
    if (!assetIdForOffer || Number(assetIdForOffer) <= 0) {
      setOfferMessage("Isi Asset ID hasil registrasi.");
      return;
    }
    try {
      setOfferMessage(null);
      writeOffer({
        address: licenseManager,
        abi: LicenseManagerABI,
        functionName: "createOffer",
        args: [
          BigInt(assetIdForOffer),
          parseEther(priceEth || "0"),
          Number(royaltyOfferBps || "0"),
          Number(ltype || "0"),
          Number(preset || "0"),
          BigInt(maxSupply || "0"),
          BigInt(duration || "0"),
          uriOffer || "ipfs://...",
        ],
      });
    } catch (err) {
      setOfferMessage(err instanceof Error ? err.message : "Failed to create offer");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <MarketplaceNav />

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Register New Asset</h1>

        {!isConnected ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Connect your wallet to register assets</p>
            <ConnectButton />
          </div>
        ) : !registryAddress ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-yellow-400">
            Please switch to a supported network (Anvil local or Sepolia)
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-6 bg-gray-900 border border-gray-800 rounded-xl p-6 mb-10">
              <h2 className="text-xl font-semibold mb-2">Step 1 — Register Asset (on-chain)</h2>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Asset File
                </label>
                <input
                  type="file"
                  accept="image/*,video/*,model/*,.glb,.gltf,.fbx,.png,.jpg,.jpeg,.gif"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  File akan di-upload ke IPFS (Pinata) lalu metadata otomatis dibuat.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nama Asset
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama asset"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Default Royalty (%)
                  </label>
                  <input
                    type="number"
                    value={Number(royaltyBPS) / 100}
                    onChange={(e) => setRoyaltyBPS(String(Number(e.target.value) * 100))}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Royalty percentage for secondary sales (0-100%)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deskripsi
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sedikit penjelasan asset"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              {uploadError && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
                  Upload error: {uploadError}
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
                  Error: {error.message}
                </div>
              )}

              {isSuccess && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-green-400">
                  Asset registered successfully! TX: {hash}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || isConfirming || uploading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
              >
                {uploading
                  ? "Uploading to IPFS..."
                  : isPending
                    ? "Confirming..."
                    : isConfirming
                      ? "Waiting for confirmation..."
                      : "Register Asset"}
              </button>
            </form>

            <form className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6 mb-10">
              <h2 className="text-xl font-semibold mb-2">Step 2 — Fractionalize (wajib sebelum jual lisensi)</h2>
              <p className="text-sm text-gray-400">Masukkan Asset ID yang sudah didaftarkan, lalu buat fractional token.</p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Asset ID</label>
                  <input
                    type="number"
                    value={assetIdInput}
                    onChange={(e) => setAssetIdInput(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  {loadingAsset && <p className="text-xs text-gray-500 mt-1">Memuat data asset...</p>}
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Price per token (ETH)</label>
                  <input
                    type="text"
                    value={pricePerToken}
                    onChange={(e) => setPricePerToken(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">FT Name</label>
                  <input
                    type="text"
                    value={ftName}
                    onChange={(e) => setFtName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">FT Symbol</label>
                  <input
                    type="text"
                    value={ftSymbol}
                    onChange={(e) => setFtSymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Total Supply</label>
                  <input
                    type="text"
                    value={totalSupply}
                    onChange={(e) => setTotalSupply(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Amount for sale</label>
                  <input
                    type="text"
                    value={amountForSale}
                    onChange={(e) => setAmountForSale(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleApproveAndFractionalize}
                    disabled={!canFractionalize || status === "approving" || status === "fractionalizing" || status === "approvingSale"}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
                  >
                    {status === "approving"
                      ? "Approving NFT..."
                      : status === "fractionalizing"
                        ? "Fractionalizing..."
                        : status === "approvingSale"
                          ? "Approving sale..."
                          : "Fractionalize"}
                  </button>
                </div>
              </div>

              {actionHash && (
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 text-blue-200 text-sm break-all">
                  TX: {actionHash}
                </div>
              )}
              {actionError && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                  {actionError}
                </div>
              )}
              {status === "done" && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 text-green-300 text-sm">
                  Fractionalize selesai. Lanjut ke Step 3 untuk jual lisensi.
                </div>
              )}
            </form>

            <form onSubmit={handleCreateOffer} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-2">Step 3 — Publish License Offer</h2>
              <p className="text-sm text-gray-400">
                Setelah fractionalize, masukkan Asset ID lalu publish lisensi langsung dari sini.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Asset ID</label>
                  <input
                    type="number"
                    value={assetIdForOffer}
                    onChange={(e) => setAssetIdForOffer(e.target.value)}
                    placeholder="Mis. 1"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Harga lisensi (ETH)</label>
                  <input
                    type="text"
                    value={priceEth}
                    onChange={(e) => setPriceEth(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Royalty BPS</label>
                  <input
                    type="number"
                    value={royaltyOfferBps}
                    onChange={(e) => setRoyaltyOfferBps(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Basis points (500 = 5%)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Type (0/1/2)</label>
                    <input
                      type="number"
                      value={ltype}
                      onChange={(e) => setLtype(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Preset (0/1/2)</label>
                    <input
                      type="number"
                      value={preset}
                      onChange={(e) => setPreset(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Max Supply (0 = unlimited)</label>
                  <input
                    type="number"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Duration (seconds, 0 = permanent)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Metadata URI</label>
                  <input
                    type="text"
                    value={uriOffer}
                    onChange={(e) => setUriOffer(e.target.value)}
                    placeholder="ipfs://..."
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Terisi otomatis setelah upload asset.</p>
                </div>
              </div>

              {offerMessage && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 text-yellow-200 text-sm">
                  {offerMessage}
                </div>
              )}

              {offerError && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
                  Offer error: {offerError.message}
                </div>
              )}

              {offerSuccess && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-green-400">
                  License offer created! TX: {offerHash}
                </div>
              )}

              <button
                type="submit"
                disabled={offerPending || offerConfirming}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
              >
                {offerPending ? "Confirm in wallet..." : offerConfirming ? "Waiting for confirmation..." : "Publish License Offer"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
