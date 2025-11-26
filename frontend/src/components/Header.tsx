"use client";

import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";

export default function Header(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isConnected } = useAccount();

  return (
    <header className="border-b border-gray-800 px-6 py-4 bg-transparent">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Lixa
            </h1>
          </Link>

          <nav className="hidden md:flex gap-6" aria-label="Primary navigation">
            <Link
              href="/marketplace"
              className="text-gray-400 hover:text-white transition"
            >
              Marketplace
            </Link>
            <Link
              href="/pools"
              className="text-gray-400 hover:text-white transition"
            >
              Pools
            </Link>
            <Link
              href="/fractionalize"
              className="text-gray-400 hover:text-white transition"
            >
              Fractionalize
            </Link>
            <Link
              href="/licenses"
              className="text-gray-400 hover:text-white transition"
            >
              Licenses
            </Link>
            <Link
              href="/create"
              className="text-gray-400 hover:text-white transition"
            >
              Create
            </Link>
            <Link
              href="/portfolio"
              className="text-gray-400 hover:text-white transition"
            >
              Portfolio
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* wallet / CTA */}
          <div className="hidden sm:flex items-center gap-3">
            {!isConnected ? (
              // ConnectButton dari RainbowKit sudah handle state & modal
              <ConnectButton showBalance={false} />
            ) : (
              <>
                <Link
                  href="/create"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:opacity-95"
                >
                  Create
                </Link>
                <ConnectButton showBalance={false} />
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md"
            onClick={() => setMobileOpen((s) => !s)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-slate-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  mobileOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-2">
            <Link
              href="/marketplace"
              className="px-2 py-2 rounded-md text-sm text-gray-200"
            >
              Marketplace
            </Link>
            <Link
              href="/pools"
              className="px-2 py-2 rounded-md text-sm text-gray-200"
            >
              Pools
            </Link>
            <Link
              href="/fractionalize"
              className="px-2 py-2 rounded-md text-sm text-gray-200"
            >
              Fractionalize
            </Link>
            <Link
              href="/licenses"
              className="px-2 py-2 rounded-md text-sm text-gray-200"
            >
              Licenses
            </Link>
            <Link
              href="/create"
              className="px-2 py-2 rounded-md text-sm text-gray-200"
            >
              Create
            </Link>
            <Link
              href="/portfolio"
              className="px-2 py-2 rounded-md text-sm text-gray-200"
            >
              Portfolio
            </Link>

            <div className="pt-2 border-t border-gray-800">
              <div className="py-2">
                <ConnectButton showBalance={false} />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
