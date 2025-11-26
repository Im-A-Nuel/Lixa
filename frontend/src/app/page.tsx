"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";
import { useState, useEffect } from "react";
import Header from "@/components/Header";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Header */}
      <Header />

      {/* Hero - Full Screen */}
      <section className="min-h-screen flex items-center justify-center px-6 relative z-10">
        {/* FULLSCREEN GIF BACKGROUND */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <img
            src="/purplewave.gif"
            alt="background animation"
            className="w-full h-full object-cover opacity-40"
          />
        </div>

        {/* OVERLAY AGAR TEKS LEBIH TERBACA */}
        <div className="absolute inset-0 bg-black/30 z-0 pointer-events-none" />

        {/* TEXT CONTENT */}
        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-bold mb-6">
              License. <span className="animated-gradient-text">Fraction.</span>{" "}
              Earn.
            </h2>

            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8">
              Marketplace for game assets with on-chain licensing and
              programmable royalties that can be fractionalized and claimed in
              real-time.
            </p>

            {!isConnected ? (
              <div className="flex justify-center"></div>
            ) : (
              <div className="flex gap-4 justify-center flex-wrap">
                <Link
                  href="/marketplace"
                  className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold text-lg transition-all transform hover:scale-105"
                >
                  Browse Marketplace
                </Link>

                <Link
                  href="/create"
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 backdrop-blur-sm"
                >
                  List Your Asset
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="min-h-screen flex items-center justify-center px-6 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-all">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">On-Chain Licensing</h3>
              <p className="text-gray-400">
                Transparent license terms with preset options: Commercial,
                Marketing, and Edu/Indie.
              </p>
            </div>

            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-pink-500/50 transition-all">
              <div className="w-12 h-12 bg-pink-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-pink-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Fractional Ownership
              </h3>
              <p className="text-gray-400">
                Split royalty streams into tradeable tokens. Earn passive income
                from license sales.
              </p>
            </div>

            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition-all">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Real-Time Dividends
              </h3>
              <p className="text-gray-400">
                Claim your share of royalties anytime. Pro-rata distribution to
                all fraction holders.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-6 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800">
              <div className="text-3xl md:text-4xl font-bold text-purple-400">
                $0
              </div>
              <div className="text-gray-400 text-sm mt-2">Total Volume</div>
            </div>
            <div className="p-6 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800">
              <div className="text-3xl md:text-4xl font-bold text-pink-400">
                0
              </div>
              <div className="text-gray-400 text-sm mt-2">Assets Listed</div>
            </div>
            <div className="p-6 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800">
              <div className="text-3xl md:text-4xl font-bold text-blue-400">
                0
              </div>
              <div className="text-gray-400 text-sm mt-2">Licenses Sold</div>
            </div>
            <div className="p-6 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800">
              <div className="text-3xl md:text-4xl font-bold text-green-400">
                $0
              </div>
              <div className="text-gray-400 text-sm mt-2">
                Royalties Distributed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Solid Background */}
      <footer className="border-t border-gray-800 px-6 py-8 bg-black relative z-10">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p className="text-gray-400 font-medium">
            Lixa - License Exchange for Game Assets
          </p>
          <p className="mt-2 text-gray-600">
            Built for hackathon demo. Use at your own risk.
          </p>
        </div>
      </footer>

      <style jsx>{`
        /* Animated Gradient Text */
        .animated-gradient-text {
          background: linear-gradient(
            90deg,
            #8b5cf6,
            #a78bfa,
            #c084fc,
            #ddd6fe,
            #e9d5ff,
            #ddd6fe,
            #c084fc,
            #a78bfa,
            #8b5cf6
          );
          background-size: 300% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 5s ease infinite;
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .hero-with-gif {
          background: url("/purplewave.gif") center/cover no-repeat;
          background-size: cover;
          /* kalau mau dimatikan di mobile, pakai media query untuk opacity */
          /* optional overlay */
          position: relative;
        }
      `}</style>
    </div>
  );
}
