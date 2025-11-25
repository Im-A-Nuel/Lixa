"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Lixa
            </h1>
            <nav className="hidden md:flex gap-6">
              <Link href="/marketplace" className="text-gray-400 hover:text-white transition">
                Marketplace
              </Link>
              <Link href="/pools" className="text-gray-400 hover:text-white transition">
                Pools
              </Link>
              <Link href="/fractionalize" className="text-gray-400 hover:text-white transition">
                Fractionalize
              </Link>
              <Link href="/licenses" className="text-gray-400 hover:text-white transition">
                Licenses
              </Link>
              <Link href="/create" className="text-gray-400 hover:text-white transition">
                Create
              </Link>
              <Link href="/portfolio" className="text-gray-400 hover:text-white transition">
                Portfolio
              </Link>
            </nav>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            License.{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Fraction.
            </span>{" "}
            Earn.
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Marketplace for game assets with on-chain licensing and programmable royalties
            that can be fractionalized and claimed in real-time.
          </p>
          {!isConnected ? (
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          ) : (
            <div className="flex gap-4 justify-center">
              <Link
                href="/marketplace"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
              >
                Browse Marketplace
              </Link>
              <Link
                href="/create"
                className="px-6 py-3 border border-gray-700 hover:border-gray-500 rounded-lg font-medium transition"
              >
                List Your Asset
              </Link>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">On-Chain Licensing</h3>
            <p className="text-gray-400">
              Transparent license terms with preset options: Commercial, Marketing, and Edu/Indie.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-12 h-12 bg-pink-600/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Fractional Ownership</h3>
            <p className="text-gray-400">
              Split royalty streams into tradeable tokens. Earn passive income from license sales.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Dividends</h3>
            <p className="text-gray-400">
              Claim your share of royalties anytime. Pro-rata distribution to all fraction holders.
            </p>
          </div>
        </div>

        {/* Stats placeholder */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-purple-400">$0</div>
            <div className="text-gray-500 text-sm">Total Volume</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-pink-400">0</div>
            <div className="text-gray-500 text-sm">Assets Listed</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-400">0</div>
            <div className="text-gray-500 text-sm">Licenses Sold</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-400">$0</div>
            <div className="text-gray-500 text-sm">Royalties Distributed</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8 mt-20">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>Lixa - License Exchange for Game Assets</p>
          <p className="mt-2">Built for hackathon demo. Use at your own risk.</p>
        </div>
      </footer>
    </div>
  );
}
