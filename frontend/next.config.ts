import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  // Ensure Alchemy AA packages are transpiled for Next bundler
  transpilePackages: [
    "@alchemy/aa-alchemy",
    "@alchemy/aa-core",
    "@alchemy/aa-accounts",
    "@alchemy/aa-signers",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
