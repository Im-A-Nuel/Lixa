"use client";

import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import Link from "next/link";
import { formatEther, formatUnits, parseUnits } from "viem";
import { getContractAddress } from "@/lib/contracts/addresses";
import FractionalizerABI from "@/lib/contracts/Fractionalizer.json";
import Header from "@/components/Header";

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
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
];

export default function PoolsPage() {
  const { chainId, isConnected, address } = useAccount();
  const fractionalizerAddress = chainId
    ? getContractAddress(chainId, "Fractionalizer")
    : undefined;

  const [amountInputs, setAmountInputs] = useState<Record<number, string>>({});

  const { data: totalPools } = useReadContract({
    address: fractionalizerAddress,
    abi: FractionalizerABI,
    functionName: "totalPools",
  });

  const poolQueries = useMemo(() => {
    if (!fractionalizerAddress || !totalPools || totalPools === 0n) return [];
    const count = Number(totalPools);
    return Array.from({ length: count }, (_, idx) => ({
      address: fractionalizerAddress,
      abi: FractionalizerABI,
      functionName: "poolInfo",
      args: [BigInt(idx + 1)],
    }));
  }, [fractionalizerAddress, totalPools]);

  const { data: poolData, isLoading } = useReadContracts({
    contracts: poolQueries,
    query: { enabled: poolQueries.length > 0 },
  });

  // Read allowances for each pool (originalOwner -> fractionalizer)
  const allowanceQueries = useMemo(() => {
    if (!fractionalizerAddress || !poolData) return [];
    return poolData
      .map((entry) => {
        if (!entry || entry.status !== "success") return null;
        const [, , ftAddress, , originalOwner] = entry.result as any;
        return {
          address: ftAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [originalOwner, fractionalizerAddress],
        };
      })
      .filter(Boolean) as any[];
  }, [fractionalizerAddress, poolData]);

  const { data: allowanceData } = useReadContracts({
    contracts: allowanceQueries,
    query: { enabled: allowanceQueries.length > 0 },
  });

  const pools = useMemo(() => {
    if (!poolData) return [];
    return poolData
      .map((entry, idx) => {
        if (!entry || entry.status !== "success") return null;
        const [
          nftContract,
          tokenId,
          ftAddress,
          totalFractions,
          originalOwner,
          salePricePerToken,
          amountForSale,
          sold,
          active,
        ] = entry.result as any;
        return {
          id: idx + 1,
          nftContract,
          tokenId,
          ftAddress,
          totalFractions,
          originalOwner,
          salePricePerToken,
          amountForSale,
          sold,
          active,
          allowance:
            allowanceData &&
            allowanceData[idx] &&
            allowanceData[idx].status === "success"
              ? (allowanceData[idx].result as bigint)
              : 0n,
        };
      })
      .filter(Boolean) as {
      id: number;
      nftContract: string;
      tokenId: bigint;
      ftAddress: string;
      totalFractions: bigint;
      originalOwner: string;
      salePricePerToken: bigint;
      amountForSale: bigint;
      sold: bigint;
      active: boolean;
      allowance: bigint;
    }[];
  }, [poolData, allowanceData]);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const {
    writeContract: writeApproveSale,
    data: approveHash,
    isPending: approvePending,
    error: approveError,
  } = useWriteContract();
  const { isLoading: approveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const handleBuy = (poolId: number, salePrice: bigint) => {
    const raw = amountInputs[poolId] || "0";
    // User enters whole tokens; convert to 18-decimal smallest units
    const amountWei = parseUnits(raw, 18);
    if (amountWei === 0n) return;
    // contract expects msg.value = (salePricePerToken * amountWei) / 1e18 (price per whole token)
    const cost = (salePrice * amountWei) / 10n ** 18n;
    writeContract({
      address: fractionalizerAddress!,
      abi: FractionalizerABI,
      functionName: "buyFractions",
      args: [BigInt(poolId), amountWei],
      value: cost,
    });
  };

  const handleApproveSale = (pool: (typeof pools)[number]) => {
    writeApproveSale({
      address: pool.ftAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [fractionalizerAddress!, pool.amountForSale],
    });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Fractional Pools</h1>
            <p className="text-gray-400">
              Buy fractional tokens from active pools.
            </p>
          </div>
          {!isConnected && <ConnectButton />}
        </div>

        {!fractionalizerAddress ? (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-yellow-400">
            Please switch to a supported network (anvil 31337 or the chain you
            deployed to).
          </div>
        ) : isLoading ? (
          <div className="text-gray-400">Loading pools...</div>
        ) : pools.length === 0 ? (
          <div className="text-gray-400">
            No pools yet. Fractionalize an asset first.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pools.map((pool) => {
              const remaining = pool.amountForSale - pool.sold;
              const priceEth = formatEther(pool.salePricePerToken); // price per whole token
              return (
                <div
                  key={pool.id}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Pool #{pool.id}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        pool.active
                          ? "bg-green-900/40 text-green-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {pool.active ? "Active" : "Closed"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 break-all">
                    FT: {pool.ftAddress}
                  </p>
                  <p className="text-sm text-gray-400 break-all">
                    NFT: {pool.nftContract} #{pool.tokenId.toString()}
                  </p>
                  <p className="text-sm text-gray-400">
                    Price / unit: {priceEth} ETH
                  </p>
                  <p className="text-sm text-gray-400">
                    For sale: {formatUnits(pool.amountForSale, 18)} | Sold:{" "}
                    {formatUnits(pool.sold, 18)} | Left:{" "}
                    {formatUnits(remaining, 18)}
                  </p>

                  <div className="space-y-2">
                    <label className="block text-xs text-gray-400">
                      Amount to buy (tokens, 18 decimals)
                    </label>
                    <input
                      type="text"
                      value={amountInputs[pool.id] ?? "0"}
                      onChange={(e) =>
                        setAmountInputs((prev) => ({
                          ...prev,
                          [pool.id]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => handleBuy(pool.id, pool.salePricePerToken)}
                      disabled={
                        !pool.active || isPending || confirming || !isConnected
                      }
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition"
                    >
                      {isPending
                        ? "Confirm in wallet..."
                        : confirming
                        ? "Broadcasting..."
                        : "Buy Fractions"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            Buy error: {error.message}
          </div>
        )}
        {isSuccess && (
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 text-green-400 text-sm">
            Purchase sent! TX: {txHash}
          </div>
        )}
      </main>
    </div>
  );
}
