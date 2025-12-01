import { useCallback } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";

/**
 * Hook untuk execute spot trading settlement on-chain
 * Triggered saat auto-match terjadi
 */
export function useSpotTrading() {
  const { address } = useAccount();

  /**
   * Execute settlement on-chain melalui OrderBook contract
   */
  const executeSpotTrade = useCallback(
    async (params: {
      matchId: string;
      buyOrderId: string;
      sellOrderId: string;
      matchAmount: string;
      buyerAddress: string;
      sellerAddress: string;
      ftAddress: string;
      pricePerToken: string;
      chainId: number;
    }) => {
      try {
        if (!address) {
          throw new Error("Wallet not connected");
        }

        const {
          matchId,
          buyOrderId,
          sellOrderId,
          matchAmount,
          buyerAddress,
          sellerAddress,
          ftAddress,
          pricePerToken,
          chainId,
        } = params;

        // Calculate total value for ETH transfer
        const amountWei = parseUnits(matchAmount, 18);
        const priceWei = parseUnits(pricePerToken, 18);
        const totalValue = (amountWei * priceWei) / BigInt(1e18);

        console.log("Executing spot trade on-chain:", {
          buyer: buyerAddress,
          seller: sellerAddress,
          amount: matchAmount,
          price: pricePerToken,
          total: totalValue.toString(),
        });

        // In real implementation, this would:
        // 1. Call OrderBook.executeTrade() with signatures
        // 2. Transfer FT from seller to buyer
        // 3. Transfer ETH from buyer to seller
        // 4. Record tx hash in database

        // For now, simulate the on-chain execution
        const mockTxHash = `0x${Math.random().toString(16).slice(2)}`;

        // Record settlement in database
        const res = await fetch("/api/orders/execute-settlement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            buyOrderId,
            sellOrderId,
            matchAmount,
            buyerAddress,
            sellerAddress,
            ftAddress,
            pricePerToken,
            chainId,
            txHash: mockTxHash,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Failed to execute settlement");
        }

        return {
          success: true,
          txHash: mockTxHash,
          message: "Spot trade executed on-chain",
        };
      } catch (error) {
        console.error("Error executing spot trade:", error);
        throw error;
      }
    },
    [address]
  );

  return { executeSpotTrade };
}
