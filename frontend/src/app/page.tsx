"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";
import { MarketplaceNav } from "@/components/MarketplaceNav";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen text-white relative">
      <div className="fixed inset-0 z-0" style={{ backgroundImage: 'url(/purplewave.gif)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(200px)', opacity: 0.3 }} />
      <div className="relative z-10">
      <MarketplaceNav />

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
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
              >
                Browse Marketplace
              </Link>
              <Link
                href="/create"
                className="px-6 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600 hover:to-pink-600 border border-purple-500/30 hover:border-purple-500 rounded-lg font-semibold transition-all backdrop-blur-sm shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
              >
                List Your Asset
              </Link>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-20 mt-32">
          <div className="group bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-purple-500/30 transition-all duration-300">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600/20 to-purple-600/5 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">On-Chain Licensing</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Transparent license terms with preset options: Commercial, Marketing, and Edu/Indie.
            </p>
          </div>

          <div className="group bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-pink-500/30 transition-all duration-300">
            <div className="w-14 h-14 bg-gradient-to-br from-pink-600/20 to-pink-600/5 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Fractional Ownership</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Split royalty streams into tradeable tokens. Earn passive income from license sales.
            </p>
          </div>

          <div className="group bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-blue-500/30 transition-all duration-300">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600/20 to-blue-600/5 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Real-Time Dividends</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Claim your share of royalties anytime. Pro-rata distribution to all fraction holders.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="group p-6 bg-gradient-to-br from-gray-900 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 hover:border-purple-500/30 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              $0
            </div>
            <div className="text-gray-400 text-sm font-medium">Total Volume</div>
          </div>
          <div className="group p-6 bg-gradient-to-br from-gray-900 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 hover:border-pink-500/30 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
              0
            </div>
            <div className="text-gray-400 text-sm font-medium">Assets Listed</div>
          </div>
          <div className="group p-6 bg-gradient-to-br from-gray-900 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 hover:border-blue-500/30 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              0
            </div>
            <div className="text-gray-400 text-sm font-medium">Licenses Sold</div>
          </div>
          <div className="group p-6 bg-gradient-to-br from-gray-900 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 hover:border-green-500/30 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
              $0
            </div>
            <div className="text-gray-400 text-sm font-medium">
              Royalties Distributed
            </div>
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
    </div>
  );
}
