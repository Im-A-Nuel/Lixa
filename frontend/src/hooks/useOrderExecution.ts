import { useCallback, useState } from "react";
import { useAccount, useWriteContract, usePublicClient, useReadContract } from "wagmi";
import { formatEther } from "viem";
import OrderBookABI from "@/lib/contracts/OrderBook.json";
import { getContractAddress } from "@/lib/contracts/addresses";
import { erc20Abi } from "viem";

/**
 * Hook untuk execute order settlement on-chain via OrderBook contract
 * Simplified flow tanpa signature untuk testing
 */
export function useOrderExecution() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<"wallet" | null>(null);

  const { writeContractAsync } = useWriteContract();

  /**
   * Check if seller has approved FT token to OrderBook
   */
  const checkAndApproveToken = useCallback(
    async (
      ftAddress: `0x${string}`,
      sellerAddress: `0x${string}`,
      orderBookAddress: `0x${string}`,
      amount: bigint
    ) => {
      if (!publicClient) {
        throw new Error("Public client not available");
      }

      // Read current allowance
      const allowance = await publicClient.readContract({
        address: ftAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [sellerAddress, orderBookAddress],
      });

      // If allowance is sufficient, no need to approve
      if (allowance >= amount) {
        return; // Already approved
      }

      // Need to approve - use max uint256 for unlimited approval
      const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

      console.log("Approving token for OrderBook...", {
        ftAddress,
        orderBookAddress,
        amount: amount.toString(),
      });

      const approveTxHash = await writeContractAsync({
        address: ftAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [orderBookAddress, MAX_UINT256.toString()],
      });

      console.log("Approval tx hash:", approveTxHash);

      // Wait for approval transaction to be confirmed
      if (approveTxHash && publicClient) {
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveTxHash,
          confirmations: 1,
        });
        console.log("Approval confirmed:", approveReceipt.status);

        if (approveReceipt.status === "reverted") {
          throw new Error("Token approval transaction reverted");
        }
      } else {
        console.warn("Approval tx hash or publicClient not available");
      }
    },
    [writeContractAsync, publicClient]
  );

  /**
   * Execute trade on-chain with pre-checks for ETH and token approval
   */
  const executeTrade = useCallback(
    async (matchId: string) => {
      try {
        if (!address || !chainId) {
          throw new Error("Wallet not connected");
        }

        setIsExecuting(true);
        setError(null);
        setLastMode("wallet");

        const orderBookAddress = getContractAddress(chainId, "OrderBook");

        if (!orderBookAddress) {
          throw new Error("OrderBook contract not found for this chain");
        }

        if (!OrderBookABI || (Array.isArray(OrderBookABI) && OrderBookABI.length === 0)) {
          throw new Error("OrderBook ABI not loaded");
        }

        console.log("OrderBook setup:", { orderBookAddress, abiLength: (OrderBookABI as any).length });

        // Get match data from server
        const prepRes = await fetch(`/api/settlement/prepare?matchId=${matchId}`);
        if (!prepRes.ok) {
          throw new Error("Failed to prepare settlement");
        }
        const prepData = await prepRes.json();
        const match = prepData.match;
        console.log("Match data received:", match);

        // Empty signatures for testing (in production these come from real signing)
        const emptySignature = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

        // Parse pool ID - convert string to number
        const poolId = BigInt(parseInt(match.poolId) || 1);

        // Construct buyer order - convert BigInt to strings to avoid serialization issues
        const buyOrder = {
          orderId: match.buyOrderId,
          side: "BID",
          poolId: poolId.toString(),
          ftAddress: match.ftAddress as `0x${string}`,
          amount: BigInt(match.amount).toString(),
          pricePerToken: BigInt(match.pricePerToken).toString(),
          userAddress: match.buyerAddress as `0x${string}`,
          nonce: "0",
          expiresAt: BigInt(match.expiresAt).toString(),
        };

        // Construct seller order - convert BigInt to strings to avoid serialization issues
        const sellOrder = {
          orderId: match.sellOrderId,
          side: "ASK",
          poolId: poolId.toString(),
          ftAddress: match.ftAddress as `0x${string}`,
          amount: BigInt(match.amount).toString(),
          pricePerToken: BigInt(match.pricePerToken).toString(),
          userAddress: match.sellerAddress as `0x${string}`,
          nonce: "0",
          expiresAt: BigInt(match.expiresAt).toString(),
        };

        // Calculate ETH to send
        const totalValue = (BigInt(match.amount) * BigInt(match.pricePerToken)) / BigInt(1e18);

        // Check 1: Verify buyer has enough ETH
        if (publicClient) {
          const buyerBalance = await publicClient.getBalance({
            address: match.buyerAddress as `0x${string}`,
          });
          if (buyerBalance < totalValue) {
            throw new Error(
              `Buyer has insufficient ETH. Need ${formatEther(totalValue)} ETH but has only ${formatEther(buyerBalance)} ETH`
            );
          }
        }

        // Check 2: Only seller can execute settlement (to ensure token approval)
        console.log("Current user:", address, "Seller:", match.sellerAddress);

        if (address?.toLowerCase() !== match.sellerAddress?.toLowerCase()) {
          throw new Error(
            `Only the seller can execute settlement. Current: ${address}, Seller: ${match.sellerAddress}`
          );
        }

        console.log("User is seller, checking token balance and approval...");

        // Check seller token balance
        const sellerBalance = await publicClient?.readContract({
          address: match.ftAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [match.sellerAddress as `0x${string}`],
        });
        console.log("Seller token balance:", sellerBalance?.toString());

        if (!sellerBalance || sellerBalance < BigInt(match.amount)) {
          throw new Error(
            `Seller has insufficient token balance. Have: ${sellerBalance?.toString() || "0"}, Need: ${match.amount}`
          );
        }

        // Auto-approve tokens if needed
        await checkAndApproveToken(
          match.ftAddress as `0x${string}`,
          match.sellerAddress as `0x${string}`,
          orderBookAddress as `0x${string}`,
          BigInt(match.amount)
        );
        console.log("Token approval check complete");

        // Execute trade on-chain
        console.log("Executing trade with args:", {
          buyOrder,
          sellOrder,
          amount: BigInt(match.amount).toString(),
          totalValue: totalValue.toString(),
          orderBookAddress,
        });

        const txHash = await writeContractAsync({
          address: orderBookAddress as `0x${string}`,
          abi: OrderBookABI as any,
          functionName: "executeTrade",
          args: [buyOrder, emptySignature, sellOrder, emptySignature, match.amount],
          value: totalValue,
        });

        console.log("Trade execution tx hash:", txHash);

        // Wait for confirmation
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });

          console.log("Trade execution receipt:", {
            status: receipt.status,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString(),
          });

          if (receipt.status === "reverted") {
            throw new Error("Trade execution reverted on-chain");
          }

          // Confirm settlement in database
          const confirmRes = await fetch("/api/settlement/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              matchId,
              txHash: receipt.transactionHash,
              blockNumber: typeof receipt.blockNumber === 'bigint' ? Number(receipt.blockNumber) : receipt.blockNumber,
            }),
          });

          if (!confirmRes.ok) {
            throw new Error("Failed to confirm settlement in database");
          }
        }

        return { success: true, txHash };
      } catch (err) {
        const error = err as Error;
        const errorMsg = error.message;
        setError(errorMsg);
        console.error("Error executing trade:", {
          message: errorMsg,
          stack: error.stack,
          fullError: error,
        });
        throw error;
      } finally {
        setIsExecuting(false);
      }
    },
    [address, chainId, writeContractAsync, publicClient, checkAndApproveToken]
  );

  return {
    executeTrade,
    isExecuting,
    error,
    lastMode,
  };
}
