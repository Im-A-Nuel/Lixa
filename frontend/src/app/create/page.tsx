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
import { FileUpload } from "@/components/FileUpload";

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

// License type options
const LICENSE_TYPES = [
  { value: "0", label: "Non-Exclusive", description: "Multiple buyers can purchase this license" },
  { value: "1", label: "Exclusive", description: "Only one buyer can hold this license at a time" },
  { value: "2", label: "Derivative", description: "Allows creating derivative works" },
];

// License preset options
const LICENSE_PRESETS = [
  { value: "0", label: "Custom", description: "Define your own terms" },
  { value: "1", label: "In-Game Commercial", description: "Full commercial usage for games" },
  { value: "2", label: "Trailer/Marketing", description: "For promotional materials only" },
  { value: "3", label: "Edu/Indie", description: "Discounted for students & indie devs" },
];

export default function CreatePage() {
  const { isConnected, chainId } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [royaltyBPS, setRoyaltyBPS] = useState("500"); // 5%
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active step tracking
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const [assetIdForOffer, setAssetIdForOffer] = useState("");
  const [priceEth, setPriceEth] = useState("0.1");
  const [royaltyOfferBps, setRoyaltyOfferBps] = useState("500"); // 5%
  const [ltype, setLtype] = useState("0");
  const [preset, setPreset] = useState("1");
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

  // Mark step 1 complete when asset is registered
  useMemo(() => {
    if (isSuccess && !completedSteps.includes(1)) {
      setCompletedSteps(prev => [...prev, 1]);
      setActiveStep(2);
    }
  }, [isSuccess, completedSteps]);

  // Mark step 2 complete when fractionalized
  useMemo(() => {
    if (status === "done" && !completedSteps.includes(2)) {
      setCompletedSteps(prev => [...prev, 2]);
      setActiveStep(3);
    }
  }, [status, completedSteps]);

  // Mark step 3 complete when license offer created
  useMemo(() => {
    if (offerSuccess && !completedSteps.includes(3)) {
      setCompletedSteps(prev => [...prev, 3]);
    }
  }, [offerSuccess, completedSteps]);

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
      setOfferMessage("Please enter a valid Asset ID.");
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

  const StepIndicator = ({ step, title, isActive, isCompleted }: { step: number; title: string; isActive: boolean; isCompleted: boolean }) => (
    <div
      className={`flex items-center gap-3 cursor-pointer transition-all ${isActive ? "opacity-100" : "opacity-60 hover:opacity-80"}`}
      onClick={() => setActiveStep(step)}
    >
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
        ${isCompleted
          ? "bg-green-500 text-white"
          : isActive
            ? "bg-purple-600 text-white ring-4 ring-purple-600/30"
            : "bg-gray-800 text-gray-400 border border-gray-700"
        }
      `}>
        {isCompleted ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : step}
      </div>
      <span className={`font-medium ${isActive ? "text-white" : "text-gray-400"}`}>{title}</span>
    </div>
  );

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Create & List Asset
          </h1>
          <p className="text-gray-400 text-lg">
            Register your game asset, fractionalize it, and create license offers.
          </p>
        </div>

        {!isConnected ? (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-2xl">
            <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to start creating and listing assets</p>
            <ConnectButton />
          </div>
        ) : !registryAddress ? (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Unsupported Network</h3>
            <p className="text-yellow-400/80">Please switch to Story Protocol Testnet (Chain ID: 1315)</p>
          </div>
        ) : (
          <>
            {/* Step Indicators */}
            <div className="flex items-center justify-between mb-10 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <StepIndicator step={1} title="Register Asset" isActive={activeStep === 1} isCompleted={completedSteps.includes(1)} />
              <div className="flex-1 h-px bg-gray-800 mx-4" />
              <StepIndicator step={2} title="Fractionalize" isActive={activeStep === 2} isCompleted={completedSteps.includes(2)} />
              <div className="flex-1 h-px bg-gray-800 mx-4" />
              <StepIndicator step={3} title="Create License" isActive={activeStep === 3} isCompleted={completedSteps.includes(3)} />
            </div>

            {/* Step 1: Register Asset */}
            <div className={`transition-all duration-300 ${activeStep === 1 ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold">1</div>
                  <h2 className="text-2xl font-bold">Register Asset</h2>
                </div>
                <p className="text-gray-400 mb-8">Upload your asset file and provide metadata. Supported: Images, 3D Models, Audio, Video.</p>

                {/* File Upload */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Asset File <span className="text-red-400">*</span>
                  </label>
                  <FileUpload
                    file={file}
                    onFileSelect={setFile}
                    maxSize={50}
                  />
                </div>

                {/* Name & Royalty */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Asset Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Dragon Character Model"
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Default Royalty
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={Number(royaltyBPS) / 100}
                        onChange={(e) => setRoyaltyBPS(String(Number(e.target.value) * 100))}
                        min="0"
                        max="50"
                        step="0.5"
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all pr-12"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Royalty for secondary sales (0-50%)</p>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your asset, its features, and potential use cases..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                  />
                </div>

                {/* Error Messages */}
                {uploadError && (
                  <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {uploadError}
                  </div>
                )}

                {error && (
                  <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error.message}
                  </div>
                )}

                {isSuccess && (
                  <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Asset registered successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending || isConfirming || uploading || !file}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading to IPFS...
                    </>
                  ) : isPending || isConfirming ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {isPending ? "Confirm in wallet..." : "Processing..."}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Register Asset
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Step 2: Fractionalize */}
            <div className={`transition-all duration-300 ${activeStep === 2 ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">2</div>
                  <h2 className="text-2xl font-bold">Fractionalize Asset</h2>
                </div>
                <p className="text-gray-400 mb-8">Convert your NFT into fractional tokens for shared ownership and royalty distribution.</p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Asset ID</label>
                    <input
                      type="number"
                      value={assetIdInput}
                      onChange={(e) => setAssetIdInput(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                    {loadingAsset && <p className="text-xs text-gray-500 mt-1">Loading asset data...</p>}
                    {asset && (asset as any).exists && (
                      <p className="text-xs text-green-400 mt-1">Asset found</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Price per Token (IP)</label>
                    <input
                      type="text"
                      value={pricePerToken}
                      onChange={(e) => setPricePerToken(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Token Name</label>
                    <input
                      type="text"
                      value={ftName}
                      onChange={(e) => setFtName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Token Symbol</label>
                    <input
                      type="text"
                      value={ftSymbol}
                      onChange={(e) => setFtSymbol(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Total Supply</label>
                    <input
                      type="text"
                      value={totalSupply}
                      onChange={(e) => setTotalSupply(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Amount for Sale</label>
                  <input
                    type="text"
                    value={amountForSale}
                    onChange={(e) => setAmountForSale(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of tokens to put up for sale in the primary market</p>
                </div>

                {actionHash && (
                  <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-blue-300 text-sm break-all">
                    Transaction: {actionHash}
                  </div>
                )}

                {actionError && (
                  <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                    {actionError}
                  </div>
                )}

                {status === "done" && (
                  <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Fractionalization complete! Continue to Step 3 to create a license offer.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleApproveAndFractionalize}
                  disabled={!canFractionalize || status === "approving" || status === "fractionalizing" || status === "approvingSale"}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {status === "approving" ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Approving NFT...
                    </>
                  ) : status === "fractionalizing" ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Fractionalizing...
                    </>
                  ) : status === "approvingSale" ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Approving Sale...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      Fractionalize Asset
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 3: Create License Offer */}
            <div className={`transition-all duration-300 ${activeStep === 3 ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              <form onSubmit={handleCreateOffer} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">3</div>
                  <h2 className="text-2xl font-bold">Create License Offer</h2>
                </div>
                <p className="text-gray-400 mb-8">Set up your license terms and pricing. Buyers will receive an NFT as proof of license.</p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Asset ID</label>
                    <input
                      type="number"
                      value={assetIdForOffer}
                      onChange={(e) => setAssetIdForOffer(e.target.value)}
                      placeholder="Enter Asset ID"
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">License Price (IP)</label>
                    <input
                      type="text"
                      value={priceEth}
                      onChange={(e) => setPriceEth(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                {/* License Type Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-3">License Type</label>
                  <div className="grid md:grid-cols-3 gap-3">
                    {LICENSE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setLtype(type.value)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          ltype === type.value
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                        }`}
                      >
                        <div className="font-medium mb-1">{type.label}</div>
                        <div className="text-xs text-gray-400">{type.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* License Preset Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-3">License Preset</label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {LICENSE_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPreset(p.value)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          preset === p.value
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                        }`}
                      >
                        <div className="font-medium mb-1">{p.label}</div>
                        <div className="text-xs text-gray-400">{p.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Max Supply</label>
                    <input
                      type="number"
                      value={maxSupply}
                      onChange={(e) => setMaxSupply(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Duration (seconds)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = permanent</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Royalty (BPS)</label>
                    <input
                      type="number"
                      value={royaltyOfferBps}
                      onChange={(e) => setRoyaltyOfferBps(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">500 = 5%</p>
                  </div>
                </div>

                {offerMessage && (
                  <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-300">
                    {offerMessage}
                  </div>
                )}

                {offerError && (
                  <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                    {offerError.message}
                  </div>
                )}

                {offerSuccess && (
                  <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    License offer created successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={offerPending || offerConfirming}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {offerPending || offerConfirming ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {offerPending ? "Confirm in wallet..." : "Processing..."}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Publish License Offer
                    </>
                  )}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
      </div>
    </div>
  );
}
