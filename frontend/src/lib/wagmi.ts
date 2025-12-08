import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { mainnet, sepolia, foundry, type Chain } from "wagmi/chains";

// Story Protocol Aeneid Testnet
export const storyTestnet: Chain = {
  id: 1315,
  name: "Story Aeneid Testnet",
  nativeCurrency: {
    name: "IP Token",
    symbol: "IP",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://aeneid.storyrpc.io"],
    },
    public: {
      http: ["https://aeneid.storyrpc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "StoryScan",
      url: "https://aeneid.storyscan.xyz",
    },
  },
  testnet: true,
};

export const config = getDefaultConfig({
  appName: "Lixa - License Exchange",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [storyTestnet, foundry, sepolia, mainnet],
  transports: {
    [storyTestnet.id]: http(process.env.NEXT_PUBLIC_STORY_RPC_URL || "https://aeneid.storyrpc.io"),
    [foundry.id]: http("http://localhost:8545"),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
  },
  ssr: true,
});
