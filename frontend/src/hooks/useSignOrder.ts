import { useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { getContractAddress } from "@/lib/contracts/addresses";

/**
 * Hook untuk sign order dengan EIP-712
 */
export function useSignOrder() {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const signOrder = useCallback(
    async (orderData: {
      orderId: string;
      side: "BID" | "ASK";
      poolId: string;
      ftAddress: string;
      amount: string;
      pricePerToken: string;
      nonce?: number;
      expiresAt: string;
    }) => {
      try {
        if (!address || !chainId) {
          throw new Error("Wallet not connected");
        }

        const orderBookAddress = getContractAddress(chainId, "OrderBook");
        if (!orderBookAddress) {
          throw new Error("OrderBook contract not found");
        }

        // Prepare EIP-712 data
        const domain = {
          name: "Lixa Order Book" as const,
          version: "1" as const,
          chainId: chainId,
          verifyingContract: orderBookAddress,
        };

        const types = {
          Order: [
            { name: "orderId", type: "string" },
            { name: "side", type: "string" },
            { name: "poolId", type: "uint256" },
            { name: "ftAddress", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "pricePerToken", type: "uint256" },
            { name: "userAddress", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "expiresAt", type: "uint256" },
          ],
        };

        const expiresAtTimestamp = Math.floor(
          new Date(orderData.expiresAt).getTime() / 1000
        );

        const message = {
          orderId: orderData.orderId,
          side: orderData.side,
          poolId: BigInt(orderData.poolId),
          ftAddress: orderData.ftAddress as `0x${string}`,
          amount: BigInt(orderData.amount),
          pricePerToken: BigInt(orderData.pricePerToken),
          userAddress: address,
          nonce: BigInt(orderData.nonce || 0),
          expiresAt: BigInt(expiresAtTimestamp),
        };

        // Sign with wallet
        const signature = await signTypedDataAsync({
          domain,
          types,
          primaryType: "Order",
          message,
        });

        return {
          success: true,
          signature,
          message,
        };
      } catch (error) {
        console.error("Error signing order:", error);
        throw error;
      }
    },
    [address, chainId, signTypedDataAsync]
  );

  return { signOrder };
}
