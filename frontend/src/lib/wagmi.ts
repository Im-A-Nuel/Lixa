import "./polyfills";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { type Chain } from "wagmi/chains";

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
  chains: [storyTestnet],
  transports: {
    [storyTestnet.id]: http(process.env.NEXT_PUBLIC_STORY_RPC_URL || "https://aeneid.storyrpc.io"),
  },
  ssr: true,
  storage: typeof window !== 'undefined' ? undefined : null,
});
