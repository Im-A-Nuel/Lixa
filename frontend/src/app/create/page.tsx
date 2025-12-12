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
import { FileUpload } from "@/components/FileUpload";
import { calculateFileHash } from "@/lib/fileHash";
import { computePerceptualHash } from "@/lib/perceptualHash";
import { getUserFriendlyError } from "@/lib/walletErrors";

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
  const { isConnected, chainId, address } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [royaltyBPS, setRoyaltyBPS] = useState("500"); // 5%
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Duplicate detection states
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    isDuplicate: boolean;
    duplicateType?: "exact" | "near";
    asset?: any;
    isSameCreator?: boolean;
    message?: string;
    confidence?: number;
  } | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [perceptualHash, setPerceptualHash] = useState<string | null>(null);

  // Auto-check for duplicates when file changes
  useEffect(() => {
    console.log("=== USEEFFECT CHECK ===");
    console.log("file:", file?.name, "address:", address);

    if (!file || !address) {
      console.log("Clearing duplicate info - no file or address");
      setDuplicateInfo(null);
      setFileHash(null);
      setPerceptualHash(null);
      return;
    }

    const checkFile = async () => {
      try {
        console.log("Starting duplicate check for:", file.name);
        setCheckingDuplicate(true);
        setDuplicateInfo(null);
        setUploadError(null);

        // Calculate SHA-256 hash
        console.log("Calculating file hash...");
        const hash = await calculateFileHash(file);
        console.log("File hash calculated:", hash);
        setFileHash(hash);

        // Calculate perceptual hash for images (near-duplicate detection)
        let pHash: string | null = null;
        if (file.type.startsWith("image/")) {
          try {
            console.log("Computing perceptual hash for image...");
            const { hash: computedHash } = await computePerceptualHash(file, file.type);
            pHash = computedHash;
            console.log("Perceptual hash computed:", pHash);
            setPerceptualHash(pHash);
          } catch (err) {
            console.warn("Failed to compute perceptual hash:", err);
            // Continue without perceptual hash - exact duplicate detection will still work
          }
        }

        // Check for duplicates via API (multi-layer detection)
        console.log("Checking for duplicates via API...");
        const res = await fetch("/api/asset/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileHash: hash,
            perceptualHash: pHash,
            mimeType: file.type,
            creator: address,
          }),
        });

        const result = await res.json();
        console.log("API response:", result);
        setDuplicateInfo(result);

        if (result?.isDuplicate) {
          console.log(`DUPLICATE DETECTED! Type: ${result.duplicateType || "exact"}`);
          setUploadError(result.message || "This file has already been uploaded");
        } else {
          console.log("File is unique, can proceed");
        }
      } catch (error) {
        console.error("Error checking file:", error);
      } finally {
        setCheckingDuplicate(false);
        console.log("=== CHECK COMPLETE ===");
      }
    };

    checkFile();
  }, [file, address]);

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

    console.log("=== SUBMIT DEBUG ===");
    console.log("registryAddress:", registryAddress);
    console.log("file:", file?.name);
    console.log("address:", address);
    console.log("duplicateInfo:", duplicateInfo);
    console.log("fileHash:", fileHash);
    console.log("checkingDuplicate:", checkingDuplicate);

    if (!registryAddress || !file || !address) {
      console.log("Missing required fields");
      return;
    }

    // Extra safety check - should already be blocked by button disable
    if (duplicateInfo?.isDuplicate) {
      console.log("BLOCKED: Duplicate detected");
      setUploadError("Cannot upload duplicate file");
      alert("Upload blocked: This file is a duplicate");
      return;
    }

    // Must have file hash from auto-check
    if (!fileHash) {
      console.log("BLOCKED: No file hash");
      setUploadError("Please wait for file verification to complete");
      alert("Please wait for file verification to complete");
      return;
    }

    console.log("All checks passed, proceeding with upload...");

    try {
      setUploadError(null);
      setUploading(true);

      // STEP 1: Upload to IPFS (duplicate already checked on file select)
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
      const ipfsCid = body.ipfsHash || body.IpfsHash || body.cid; // Get CID from upload response

      if (!metadataURI) {
        setUploadError("Metadata URI not returned");
        setUploading(false);
        return;
      }

      if (!ipfsCid) {
        setUploadError("IPFS CID not returned from upload");
        setUploading(false);
        return;
      }

      // STEP 2: Register asset in database with IPFS CID for deduplication
      // CID is deterministic - same file content = same CID
      const registerRes = await fetch("/api/asset/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipfsCid: ipfsCid, // IPFS CID is the primary deduplication key
          fileHash: fileHash,
          creator: address,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          ipfsHash: ipfsCid,
          metadataURI,
          // Perceptual hash for near-duplicate detection
          perceptualHash: perceptualHash,
          perceptualType: perceptualHash ? "dhash" : null,
        }),
      });

      const registerData = await registerRes.json();
      
      // Check if asset already exists (duplicate CID)
      if (!registerRes.ok) {
        if (registerRes.status === 409) {
          // Conflict - duplicate detected
          setUploadError(registerData.error || "This file has already been uploaded (duplicate CID)");
          setUploading(false);
          return;
        }
        setUploadError(registerData.error || "Failed to register asset");
        setUploading(false);
        return;
      }

      // STEP 3: Register on blockchain (only if database registration succeeded)
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
      const errorMsg = getUserFriendlyError(err);
      if (errorMsg) {
        setActionError(errorMsg);
      }
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
      const errorMsg = getUserFriendlyError(err);
      if (errorMsg) {
        setOfferMessage(errorMsg);
      }
    }
  };

  const StepIndicator = ({ step, title, isActive, isCompleted }: { step: number; title: string; isActive: boolean; isCompleted: boolean }) => {
    const getStepColor = () => {
      if (step === 1) return { active: "from-purple-600 to-purple-700", ring: "ring-purple-500/30", glow: "shadow-purple-500/50" };
      if (step === 2) return { active: "from-indigo-600 to-indigo-700", ring: "ring-indigo-500/30", glow: "shadow-indigo-500/50" };
      return { active: "from-blue-600 to-cyan-600", ring: "ring-blue-500/30", glow: "shadow-blue-500/50" };
    };
    const colors = getStepColor();

    return (
      <div
        className={`flex items-center gap-3 cursor-pointer transition-all duration-300 ${isActive ? "opacity-100 scale-105" : "opacity-60 hover:opacity-90 hover:scale-102"}`}
        onClick={() => setActiveStep(step)}
      >
        <div className={`
          w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-300
          ${isCompleted
            ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/40"
            : isActive
              ? `bg-gradient-to-br ${colors.active} text-white ring-4 ${colors.ring} shadow-lg ${colors.glow}`
              : "bg-gray-800/70 text-gray-400 border-2 border-gray-700/50"
          }
        `}>
          {isCompleted ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : step}
        </div>
        <div className="flex flex-col">
          <span className={`font-bold text-sm transition-all duration-300 ${isActive ? "text-white" : "text-gray-400"}`}>{title}</span>
          {isActive && <span className="text-[10px] text-purple-400 font-medium">Active</span>}
          {isCompleted && !isActive && <span className="text-[10px] text-green-400 font-medium">Completed</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-sm text-purple-300 font-medium">Create New Asset</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent">
            Bring Your Asset to Life
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Transform your digital creation into a tradeable asset. Upload, fractionalize, and license with ease.
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
            <div className="mb-12 bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <StepIndicator step={1} title="Register Asset" isActive={activeStep === 1} isCompleted={completedSteps.includes(1)} />
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-700 mx-4 relative">
                  {completedSteps.includes(1) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 h-full" />
                  )}
                </div>
                <StepIndicator step={2} title="Fractionalize" isActive={activeStep === 2} isCompleted={completedSteps.includes(2)} />
                <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-700 mx-4 relative">
                  {completedSteps.includes(2) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 h-full" />
                  )}
                </div>
                <StepIndicator step={3} title="Create License" isActive={activeStep === 3} isCompleted={completedSteps.includes(3)} />
              </div>
            </div>

            {/* Step 1: Register Asset */}
            <div className={`transition-all duration-500 ${activeStep === 1 ? "opacity-100 scale-100" : "opacity-40 scale-95 pointer-events-none"}`}>
              <form onSubmit={handleSubmit} className="bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-3xl p-10 mb-8 shadow-2xl hover:border-purple-500/30 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center text-lg font-bold shadow-lg shadow-purple-500/20">
                    1
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Register Asset</h2>
                    <p className="text-gray-500 text-sm mt-1">Upload and mint your digital asset</p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-8"></div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-8">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-blue-300/90 text-sm">
                      <strong className="text-blue-200">Supported formats:</strong> Images (PNG, JPG, GIF, SVG), 3D Models (GLB, GLTF, FBX), Audio (MP3, WAV), Video (MP4, WEBM)
                    </p>
                  </div>
                </div>

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
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Asset Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Dragon Character Model"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                      required
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
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
                        className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-gray-800 transition-all duration-200 pr-12 group-hover:border-gray-600"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Royalty for secondary sales (0-50%)
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-8 group">
                  <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your asset in detail. Include features, technical specifications, use cases, and what makes it unique..."
                    rows={4}
                    className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-gray-800 transition-all duration-200 resize-none placeholder:text-gray-500 group-hover:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Optional but recommended for better discoverability
                  </p>
                </div>

                {/* Duplicate Warning */}
                {duplicateInfo?.isDuplicate && (
                  <div className={`mb-6 bg-gradient-to-r ${
                    duplicateInfo.duplicateType === "exact"
                      ? "from-red-500/10 to-orange-500/10 border-red-500/30"
                      : "from-yellow-500/10 to-orange-500/10 border-yellow-500/30"
                  } border rounded-xl p-5`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full ${
                        duplicateInfo.duplicateType === "exact" ? "bg-red-500/20" : "bg-yellow-500/20"
                      } flex items-center justify-center flex-shrink-0`}>
                        <svg className={`w-5 h-5 ${
                          duplicateInfo.duplicateType === "exact" ? "text-red-400" : "text-yellow-400"
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        {duplicateInfo.duplicateType === "exact" ? (
                          <>
                            <h3 className="font-bold text-red-400 mb-2 text-lg">🚫 Exact Duplicate Detected</h3>
                            <p className="text-red-300/90 text-sm mb-1 font-semibold">
                              This exact file content has already been uploaded to the platform.
                            </p>
                            <p className="text-red-300/70 text-xs mb-4">
                              Even if the filename is different, we detected that the file content is identical to an existing asset.
                            </p>
                          </>
                        ) : (
                          <>
                            <h3 className="font-bold text-yellow-400 mb-2 text-lg">⚠️ Similar File Detected</h3>
                            <p className="text-yellow-300/90 text-sm mb-1 font-semibold">
                              This file appears to be very similar to an existing asset ({Math.round((duplicateInfo.confidence || 0) * 100)}% match).
                            </p>
                            <p className="text-yellow-300/70 text-xs mb-4">
                              The file may have been resized, re-encoded, or slightly modified. This could indicate a near-duplicate upload.
                            </p>
                          </>
                        )}
                        {duplicateInfo.asset && (
                          <div className="bg-gray-900/70 border border-red-500/20 rounded-lg p-4 text-xs space-y-2">
                            <p className="text-gray-300 font-semibold text-sm border-b border-gray-800 pb-2 mb-2">Original Asset Details:</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Upload Date</p>
                                <p className="text-gray-300 font-mono">{new Date(duplicateInfo.asset.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">File Name</p>
                                <p className="text-gray-300 font-mono break-all">{duplicateInfo.asset.fileName}</p>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-gray-800">
                              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Creator Address</p>
                              <p className="text-gray-300 font-mono text-xs break-all bg-gray-950 px-2 py-1 rounded">
                                {duplicateInfo.asset.creator}
                              </p>
                            </div>
                            {duplicateInfo.asset.fileHash && (
                              <div className="pt-2 border-t border-gray-800">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">File Hash (SHA-256)</p>
                                <p className="text-gray-400 font-mono text-[9px] break-all bg-gray-950 px-2 py-1 rounded">
                                  {duplicateInfo.asset.fileHash}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {duplicateInfo.duplicateType === "exact" ? (
                          // Exact duplicate - always block
                          duplicateInfo.isSameCreator ? (
                            <div className="mt-4 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                              <p className="text-orange-300 text-xs flex items-start gap-2">
                                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span><strong>Note:</strong> This is your own previously uploaded file. Uploading it again would create a duplicate asset on the blockchain.</span>
                              </p>
                            </div>
                          ) : (
                            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                              <p className="text-red-300 text-xs flex items-start gap-2">
                                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span><strong>Upload Blocked:</strong> This file content was originally uploaded by another creator. To protect intellectual property rights, duplicate uploads are not allowed.</span>
                              </p>
                            </div>
                          )
                        ) : (
                          // Near-duplicate - warning but currently blocked (can be made optional)
                          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                            <p className="text-yellow-300 text-xs flex items-start gap-2">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span><strong>Warning:</strong> While this file is not an exact duplicate, it's very similar to an existing asset. Please verify that you have the right to upload this content and that it's genuinely different from the existing asset.</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Checking Duplicate Status */}
                {checkingDuplicate && (
                  <div className="mb-6 flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-blue-400">
                    <svg className="animate-spin w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking for duplicate files...
                  </div>
                )}

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
                  disabled={isPending || isConfirming || uploading || !file || duplicateInfo?.isDuplicate || checkingDuplicate}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:via-purple-400 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:shadow-none disabled:scale-100"
                >
                  {checkingDuplicate ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying file...
                    </>
                  ) : duplicateInfo?.isDuplicate ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Upload Blocked - Duplicate File
                    </>
                  ) : uploading ? (
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
            <div className={`transition-all duration-500 ${activeStep === 2 ? "opacity-100 scale-100" : "opacity-40 scale-95 pointer-events-none"}`}>
              <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-3xl p-10 mb-8 shadow-2xl hover:border-indigo-500/30 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-500/20">
                    2
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Fractionalize Asset</h2>
                    <p className="text-gray-500 text-sm mt-1">Enable shared ownership and trading</p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-8"></div>

                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 mb-8">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-indigo-300/90 text-sm">
                      <strong className="text-indigo-200">Fractionalization:</strong> Split your NFT into ERC-20 tokens, allowing multiple people to own and trade shares of your asset.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      Asset ID
                    </label>
                    <input
                      type="number"
                      value={assetIdInput}
                      onChange={(e) => setAssetIdInput(e.target.value)}
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-gray-800 transition-all duration-200 group-hover:border-gray-600"
                    />
                    {loadingAsset && (
                      <p className="text-xs text-blue-400 mt-2 flex items-center gap-1 animate-pulse">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading asset data...
                      </p>
                    )}
                    {asset && (asset as any).exists && (
                      <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Asset found
                      </p>
                    )}
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Price per Token (IP)
                    </label>
                    <input
                      type="text"
                      value={pricePerToken}
                      onChange={(e) => setPricePerToken(e.target.value)}
                      placeholder="0.001"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3">Token Name</label>
                    <input
                      type="text"
                      value={ftName}
                      onChange={(e) => setFtName(e.target.value)}
                      placeholder="e.g., Fractional Asset"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3">Token Symbol</label>
                    <input
                      type="text"
                      value={ftSymbol}
                      onChange={(e) => setFtSymbol(e.target.value)}
                      placeholder="e.g., FRAC"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3">Total Supply</label>
                    <input
                      type="text"
                      value={totalSupply}
                      onChange={(e) => setTotalSupply(e.target.value)}
                      placeholder="1000"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                  </div>
                </div>

                <div className="mb-8 group">
                  <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Amount for Sale
                  </label>
                  <input
                    type="text"
                    value={amountForSale}
                    onChange={(e) => setAmountForSale(e.target.value)}
                    placeholder="500"
                    className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Number of tokens to list for sale in the primary market
                  </p>
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
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:via-indigo-400 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:shadow-none disabled:scale-100"
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
            <div className={`transition-all duration-500 ${activeStep === 3 ? "opacity-100 scale-100" : "opacity-40 scale-95 pointer-events-none"}`}>
              <form onSubmit={handleCreateOffer} className="bg-gradient-to-br from-gray-900/80 via-gray-900/50 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-3xl p-10 shadow-2xl hover:border-blue-500/30 transition-all duration-300">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-500/20">
                    3
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Create License Offer</h2>
                    <p className="text-gray-500 text-sm mt-1">Define usage rights and licensing terms</p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-8"></div>

                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4 mb-8">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <p className="text-cyan-300/90 text-sm">
                      <strong className="text-cyan-200">Licensing:</strong> Create customizable license offers with specific terms. Buyers receive an NFT as proof of license ownership.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      Asset ID
                    </label>
                    <input
                      type="number"
                      value={assetIdForOffer}
                      onChange={(e) => setAssetIdForOffer(e.target.value)}
                      placeholder="Enter Asset ID"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                      required
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      License Price (IP)
                    </label>
                    <input
                      type="text"
                      value={priceEth}
                      onChange={(e) => setPriceEth(e.target.value)}
                      placeholder="0.1"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                  </div>
                </div>

                {/* License Type Selection */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    License Type
                  </label>
                  <div className="grid md:grid-cols-3 gap-4">
                    {LICENSE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setLtype(type.value)}
                        className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 group ${
                          ltype === type.value
                            ? "border-purple-500 bg-gradient-to-br from-purple-500/20 to-purple-600/10 shadow-lg shadow-purple-500/20"
                            : "border-gray-700/50 bg-gray-800/40 hover:border-purple-500/50 hover:bg-gray-800/60"
                        }`}
                      >
                        <div className={`font-bold mb-2 text-base ${ltype === type.value ? "text-purple-300" : "text-gray-300 group-hover:text-purple-300"}`}>
                          {type.label}
                        </div>
                        <div className="text-xs text-gray-400 leading-relaxed">{type.description}</div>
                        {ltype === type.value && (
                          <div className="mt-3 flex items-center gap-2 text-purple-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-semibold">Selected</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* License Preset Selection */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    License Preset
                  </label>
                  <div className="grid md:grid-cols-2 gap-4">
                    {LICENSE_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPreset(p.value)}
                        className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 group ${
                          preset === p.value
                            ? "border-indigo-500 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 shadow-lg shadow-indigo-500/20"
                            : "border-gray-700/50 bg-gray-800/40 hover:border-indigo-500/50 hover:bg-gray-800/60"
                        }`}
                      >
                        <div className={`font-bold mb-2 text-base ${preset === p.value ? "text-indigo-300" : "text-gray-300 group-hover:text-indigo-300"}`}>
                          {p.label}
                        </div>
                        <div className="text-xs text-gray-400 leading-relaxed">{p.description}</div>
                        {preset === p.value && (
                          <div className="mt-3 flex items-center gap-2 text-indigo-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-semibold">Selected</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3">Max Supply</label>
                    <input
                      type="number"
                      value={maxSupply}
                      onChange={(e) => setMaxSupply(e.target.value)}
                      placeholder="0"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      0 = unlimited licenses
                    </p>
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3">Duration (seconds)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="0"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      0 = permanent license
                    </p>
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-300 mb-3">Royalty (BPS)</label>
                    <input
                      type="number"
                      value={royaltyOfferBps}
                      onChange={(e) => setRoyaltyOfferBps(e.target.value)}
                      placeholder="500"
                      className="w-full px-5 py-3.5 bg-gray-800/70 border border-gray-600/50 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-gray-800 transition-all duration-200 placeholder:text-gray-500 group-hover:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      500 = 5% royalty
                    </p>
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
                  className="w-full py-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-600 hover:from-blue-500 hover:via-cyan-400 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:shadow-none disabled:scale-100"
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
