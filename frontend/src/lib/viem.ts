import { createPublicClient, http } from "viem";
import { foundry, sepolia, mainnet } from "viem/chains";

const getRpcUrl = (chainId: number): string => {
  switch (chainId) {
    case foundry.id:
      return "http://localhost:8545";
    case sepolia.id:
      return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://sepolia.drpc.org";
    case mainnet.id:
      return process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://eth.drpc.org";
    default:
      return "http://localhost:8545";
  }
};

export const publicClient = createPublicClient({
  chain: foundry,
  transport: http(getRpcUrl(foundry.id)),
});

export const getPublicClient = (chainId: number) => {
  const chain = [foundry, sepolia, mainnet].find((c) => c.id === chainId) || foundry;
  return createPublicClient({
    chain,
    transport: http(getRpcUrl(chainId)),
  });
};
