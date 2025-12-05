"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi";
import { useMemo, useState, useEffect } from "react";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import LicenseManagerABI from "@/lib/contracts/LicenseManager.json";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import { parseEther, parseUnits } from "viem";
import { MarketplaceNav } from "@/components/MarketplaceNav";
import { ErrorMessage } from "@/components/ErrorMessage";

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
  const [fileName, setFileName] = useState<string>("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "3d" | "audio" | "other" | null>(null);
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

  // Cleanup object URL on unmount or when file changes
  useEffect(() => {
    return () => {
      if (filePreview && fileType === '3d') {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview, fileType]);

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
              <div className="flex items-center gap-3 pb-4 border-b border-gray-800">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 text-white font-bold text-lg shadow-lg">
                  1
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Register Asset</h2>
                  <p className="text-sm text-gray-400">Upload and mint your asset on-chain</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Asset File
                </label>
                <div className="relative">
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*,audio/*,.glb,.gltf,.fbx,.obj"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0] || null;
                      setFile(selectedFile);
                      setFileName(selectedFile?.name || "");

                      if (selectedFile) {
                        // Detect file type
                        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
                        const mimeType = selectedFile.type;

                        if (mimeType.startsWith('image/')) {
                          setFileType('image');
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFilePreview(reader.result as string);
                          };
                          reader.readAsDataURL(selectedFile);
                        } else if (mimeType.startsWith('audio/')) {
                          setFileType('audio');
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFilePreview(reader.result as string);
                          };
                          reader.readAsDataURL(selectedFile);
                        } else if (fileExt && ['glb', 'gltf', 'fbx', 'obj'].includes(fileExt)) {
                          setFileType('3d');
                          // For 3D models, create object URL instead of data URL
                          const objectUrl = URL.createObjectURL(selectedFile);
                          setFilePreview(objectUrl);
                        } else {
                          setFileType('other');
                          setFilePreview(null);
                        }
                      } else {
                        setFilePreview(null);
                        setFileType(null);
                      }
                    }}
                    className="hidden"
                    required
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-800 border-2 border-dashed border-gray-600 hover:border-purple-500 rounded-lg cursor-pointer transition-all hover:bg-gray-750"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-gray-300">
                      {fileName ? fileName : "Click to choose file"}
                    </span>
                  </label>
                </div>

                {/* File Preview */}
                {file && filePreview && (
                  <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-300">Preview:</p>
                      <button
                        type="button"
                        onClick={() => {
                          // Cleanup object URL for 3D models
                          if (filePreview && fileType === '3d') {
                            URL.revokeObjectURL(filePreview);
                          }
                          setFile(null);
                          setFileName("");
                          setFilePreview(null);
                          setFileType(null);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition"
                      >
                        Remove
                      </button>
                    </div>

                    {fileType === 'image' && (
                      <div className="flex justify-center">
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="max-w-full h-auto max-h-80 rounded-lg shadow-lg"
                        />
                      </div>
                    )}

                    {fileType === 'audio' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-gray-400">
                          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                          </svg>
                          <div>
                            <p className="font-medium text-gray-300">{fileName}</p>
                            <p className="text-sm">Audio File</p>
                          </div>
                        </div>
                        <audio
                          controls
                          src={filePreview}
                          className="w-full"
                        />
                      </div>
                    )}

                    {fileType === '3d' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-gray-400 bg-gray-900 p-3 rounded-lg">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <div className="flex-1">
                            <p className="font-medium text-gray-300">{fileName}</p>
                            <p className="text-sm">3D Model</p>
                            <p className="text-xs mt-1">
                              Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                          <model-viewer
                            src={filePreview}
                            alt="3D Model Preview"
                            auto-rotate
                            camera-controls
                            style={{
                              width: '100%',
                              height: '400px',
                              background: 'linear-gradient(to bottom right, rgba(88, 28, 135, 0.1), rgba(219, 39, 119, 0.1))'
                            }}
                            class="w-full"
                          >
                            <div slot="progress-bar" style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100%',
                              color: '#9CA3AF'
                            }}>
                              <p>Loading 3D Model...</p>
                            </div>
                          </model-viewer>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                          🖱️ Drag to rotate • Scroll to zoom • Right-click to pan
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-sm text-gray-500 mt-2">
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
                <ErrorMessage error={uploadError} onDismiss={() => setUploadError(null)} />
              )}

              {error && (
                <ErrorMessage error={error} />
              )}

              {isSuccess && hash && (
                <div className="bg-green-900/30 border border-green-600 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-green-400 mb-1">Asset registered successfully!</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-400">Transaction:</p>
                        <code className="text-xs text-green-300 bg-green-950/50 px-2 py-1 rounded break-all">
                          {hash.slice(0, 10)}...{hash.slice(-8)}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(hash);
                          }}
                          className="text-xs text-green-400 hover:text-green-300 underline"
                          title="Copy full hash"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
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
              <div className="flex items-center gap-3 pb-4 border-b border-gray-800">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-pink-600 to-pink-700 text-white font-bold text-lg shadow-lg">
                  2
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Fractionalize Asset</h2>
                  <p className="text-sm text-gray-400">Create fractional tokens (required before selling licenses)</p>
                </div>
              </div>
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
                <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-blue-300 font-medium">Transaction:</p>
                    <code className="text-xs text-blue-200 bg-blue-950/50 px-2 py-1 rounded break-all">
                      {actionHash.slice(0, 10)}...{actionHash.slice(-8)}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(actionHash);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                      title="Copy full hash"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
              {actionError && (
                <ErrorMessage error={actionError} onDismiss={() => setActionError(undefined)} />
              )}
              {status === "done" && (
                <div className="bg-green-900/30 border border-green-600 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-green-400">Fractionalization complete!</p>
                      <p className="text-sm text-gray-400 mt-1">Proceed to Step 3 to publish license offer.</p>
                    </div>
                  </div>
                </div>
              )}
            </form>

            <form onSubmit={handleCreateOffer} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-800">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-lg shadow-lg">
                  3
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Publish License Offer</h2>
                  <p className="text-sm text-gray-400">Create license offer for your asset</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Setelah fractionalize, masukkan Asset ID lalu publish lisensi langsung dari sini.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Asset ID</label>
                  <input
                    type="number"
                    value={assetIdForOffer}
                    onChange={(e) => setAssetIdForOffer(e.target.value)}
                    placeholder="e.g., 1"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Asset ID from Step 1</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">License Price (ETH)</label>
                  <input
                    type="text"
                    value={priceEth}
                    onChange={(e) => setPriceEth(e.target.value)}
                    placeholder="0.1"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-1">Price per license in ETH</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Royalty BPS</label>
                  <input
                    type="number"
                    value={royaltyOfferBps}
                    onChange={(e) => setRoyaltyOfferBps(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-1">Basis points (500 = 5%)</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">License Type</label>
                    <select
                      value={ltype}
                      onChange={(e) => setLtype(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="0">Commercial Use</option>
                      <option value="1">Marketing/Promotional</option>
                      <option value="2">Educational/Indie</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Choose the license usage type</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">License Preset</label>
                    <select
                      value={preset}
                      onChange={(e) => setPreset(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="0">Standard</option>
                      <option value="1">Premium</option>
                      <option value="2">Custom</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Select license tier/preset</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max Supply</label>
                  <input
                    type="number"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = unlimited supply</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Duration (seconds)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = permanent license</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Metadata URI</label>
                <input
                  type="text"
                  value={uriOffer}
                  onChange={(e) => setUriOffer(e.target.value)}
                  placeholder="ipfs://..."
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-xs text-gray-500 mt-1">Terisi otomatis setelah upload asset.</p>
              </div>

              {offerMessage && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 text-yellow-200 text-sm">
                  {offerMessage}
                </div>
              )}

              {offerError && (
                <ErrorMessage error={offerError} />
              )}

              {offerSuccess && offerHash && (
                <div className="bg-green-900/30 border border-green-600 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-green-400 mb-1">License offer created successfully!</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-400">Transaction:</p>
                        <code className="text-xs text-green-300 bg-green-950/50 px-2 py-1 rounded break-all">
                          {offerHash.slice(0, 10)}...{offerHash.slice(-8)}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(offerHash);
                          }}
                          className="text-xs text-green-400 hover:text-green-300 underline"
                          title="Copy full hash"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
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
