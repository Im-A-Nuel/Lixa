// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  // Anvil local (chain ID: 31337)
  31337: {
    AssetNFT: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    AssetRegistry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    Fractionalizer: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    LicenseNFT: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    LicenseManager: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    SecondaryMarket: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  },
  // Sepolia testnet (chain ID: 11155111) - to be filled after deployment
  11155111: {
    AssetNFT: "",
    AssetRegistry: "",
    Fractionalizer: "",
    LicenseNFT: "",
    LicenseManager: "",
    SecondaryMarket: "",
  },
} as const;

export type SupportedChainId = keyof typeof CONTRACT_ADDRESSES;

export function getContractAddress(
  chainId: number,
  contract: keyof (typeof CONTRACT_ADDRESSES)[31337]
): `0x${string}` | undefined {
  const addresses = CONTRACT_ADDRESSES[chainId as SupportedChainId];
  if (!addresses) return undefined;
  const addr = addresses[contract];
  return addr ? (addr as `0x${string}`) : undefined;
}
