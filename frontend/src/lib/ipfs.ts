// Default gateway can be overridden via NEXT_PUBLIC_IPFS_GATEWAY (client-safe).
const DEFAULT_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
// Ordered fallbacks with generous CORS and range support for 3D/model assets.
const FALLBACK_GATEWAYS = [
  process.env.NEXT_PUBLIC_IPFS_FALLBACK_GATEWAY || "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://4everland.io/ipfs/",
];

export const ipfsToHttp = (uri: string, gateway = DEFAULT_GATEWAY) => {
  if (!uri) return uri;
  return uri.startsWith("ipfs://") ? uri.replace("ipfs://", gateway) : uri;
};

// Return a deduped list of gateway URLs for an IPFS URI (primary + fallbacks).
export const ipfsHttpGateways = (uri?: string) => {
  if (!uri) return [] as string[];
  const all = [ipfsToHttp(uri), ...FALLBACK_GATEWAYS.map((g) => ipfsToHttp(uri, g))];
  return Array.from(new Set(all));
};
