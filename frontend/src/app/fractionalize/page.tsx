"use client";

import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import Link from "next/link";
import { parseUnits, parseEther } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import AssetRegistryABI from "@/lib/contracts/AssetRegistry.json";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
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

export default function FractionalizePage() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const registryAddress = chainId ? getContractAddress(chainId, "AssetRegistry") : undefined;
  const fractionalizerAddress = chainId ? getContractAddress(chainId, "Fractionalizer") : undefined;

  const [assetIdInput, setAssetIdInput] = useState("1");
  const assetId = assetIdInput ? BigInt(assetIdInput) : undefined;

  const [ftName, setFtName] = useState("Fractional Asset");
  const [ftSymbol, setFtSymbol] = useState("FRAC");
  const [totalSupply, setTotalSupply] = useState("1000");
  const [amountForSale, setAmountForSale] = useState("500");
  const [pricePerToken, setPricePerToken] = useState("0.001"); // in IP

  const [actionHash, setActionHash] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "approving" | "fractionalizing" | "approvingSale" | "done">("idle");

  const { data: asset, error: assetError, isLoading: loadingAsset } = useReadContract({
    address: registryAddress,
    abi: AssetRegistryABI,
    functionName: "getAsset",
    args: assetId ? [assetId] : undefined,
    query: { enabled: Boolean(registryAddress && assetId) },
  });

  // Check current approval for the NFT
  const { data: currentApproval } = useReadContract({
    address: asset ? ((asset as any).nftContract as `0x${string}`) : undefined,
    abi: ERC721_APPROVE_ABI,
    functionName: "getApproved",
    args: asset ? [(asset as any).tokenId as bigint] : undefined,
    query: { enabled: Boolean(asset) },
  });

  const { writeContractAsync } = useWriteContract();

  const canFractionalize = useMemo(() => {
    return Boolean(
      isConnected &&
        address &&
        registryAddress &&
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
  }, [
    isConnected,
    address,
    registryAddress,
    fractionalizerAddress,
    asset,
    assetId,
    ftName,
    ftSymbol,
    totalSupply,
    amountForSale,
    pricePerToken,
  ]);

  const handleApproveAndFractionalize = async () => {
    if (!asset || !fractionalizerAddress || !address || !assetId) return;
    const nftContract = (asset as any).nftContract as `0x${string}`;
    const tokenId = (asset as any).tokenId as bigint;

    setActionError(undefined);
    setActionHash(undefined);

    try {
      // Step 1: approve if needed
      if (!currentApproval || (typeof currentApproval === 'string' && currentApproval.toLowerCase() !== fractionalizerAddress.toLowerCase())) {
        setStatus("approving");
        const approveHash = await writeContractAsync({
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

      // Step 2: fractionalize
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

      const fracHash = await writeContractAsync({
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
          address,
        ],
      });
      setActionHash(fracHash as `0x${string}`);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: fracHash as `0x${string}` });
      }

      // Step 3: auto-approve sale amount from FT owner to Fractionalizer
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
          const approveSaleHash = await writeContractAsync({
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

          // Step 4: Register token in database with unique symbol validation
          try {
            const registerRes = await fetch("/api/token/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                poolId: Number(poolId),
                ftAddress: ftAddress.toLowerCase(),
                ftName,
                ftSymbol: ftSymbol.toUpperCase(),
                assetId: Number(assetId),
              }),
            });

            const registerJson = await registerRes.json();
            if (!registerRes.ok) {
              console.error(
                "Token registration failed:",
                registerJson.error
              );
              // Show error message to user but don't fail the process
              setActionError(
                `Token registered on-chain but DB registration failed: ${registerJson.error}`
              );
            } else {
              console.log("Token registered successfully:", registerJson.token);
            }
          } catch (err) {
            console.error("Error registering token:", err);
          }
        } catch (err) {
          console.error("Auto-approve sale failed", err);
        }
      }
      setStatus("done");
    } catch (err: any) {
      const errorMsg = getUserFriendlyError(err);
      if (errorMsg) {
        setActionError(errorMsg);
      }
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
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
              <Link href="/fractionalize" className="text-white font-medium">
                Fractionalize
              </Link>
              <Link href="/licenses" className="text-gray-400 hover:text-white transition">
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

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fractionalize Asset</h1>
          <p className="text-gray-400">Lock your AssetNFT and mint fractional ERC-20 tokens.</p>
        </div>

        {!isConnected ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to continue</p>
            <ConnectButton />
          </div>
        ) : !registryAddress || !fractionalizerAddress ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-yellow-400">
            Please switch to a supported network (Anvil 31337 or the chain you deployed to).
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Asset ID</label>
              <input
                type="number"
                value={assetIdInput}
                onChange={(e) => setAssetIdInput(e.target.value)}
                min="1"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
              <p className="text-sm text-gray-500 mt-1">Enter an existing assetId from the registry.</p>
              {loadingAsset && <p className="text-sm text-gray-400 mt-2">Loading asset...</p>}
              {assetError && <p className="text-sm text-red-400 mt-2">Error: {assetError.message}</p>}
              {asset && !(asset as any).exists && (
                <p className="text-sm text-red-400 mt-2">Asset not found.</p>
              )}
              {asset && (asset as any).exists && (
                <div className="text-sm text-gray-300 mt-2 space-y-1">
                  <p>Creator: {(asset as any).creator}</p>
                  <p>NFT: {(asset as any).nftContract}</p>
                  <p>Token ID: {(asset as any).tokenId.toString()}</p>
                  <p>Metadata: {(asset as any).metadataURI}</p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">FT Name</label>
                <input
                  type="text"
                  value={ftName}
                  onChange={(e) => setFtName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">FT Symbol</label>
                <input
                  type="text"
                  value={ftSymbol}
                  onChange={(e) => setFtSymbol(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid md-grid-cols-2 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Total Supply (tokens)</label>
                <input
                  type="number"
                  value={totalSupply}
                  min="1"
                  onChange={(e) => setTotalSupply(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                />
                <p className="text-sm text-gray-500 mt-1">Uses 18 decimals (e.g., 1000 = 1000 * 1e18).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount For Sale (tokens)</label>
                <input
                  type="number"
                  value={amountForSale}
                  min="0"
                  onChange={(e) => setAmountForSale(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Price per Token (IP)</label>
              <input
                type="text"
                value={pricePerToken}
                onChange={(e) => setPricePerToken(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            {actionError && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
                Error: {actionError}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="text-sm text-gray-400 space-y-1">
                <p>Status: {status === "idle" ? "Idle" : status === "approving" ? "Approving NFT" : status === "fractionalizing" ? "Fractionalizing" : "Done"}</p>
                {actionHash && <p className="break-all">Last TX: {actionHash}</p>}
              </div>
              <button
                type="button"
                onClick={handleApproveAndFractionalize}
                disabled={!canFractionalize || status === "approving" || status === "fractionalizing"}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
              >
                {status === "approving"
                  ? "Approving..."
                  : status === "fractionalizing"
                  ? "Fractionalizing..."
                  : "Approve + Fractionalize"}
              </button>
            </div>

            {status === "done" && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 text-green-400 text-sm">
                Fractionalization complete! {actionHash ? `TX: ${actionHash}` : ""}
              </div>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
