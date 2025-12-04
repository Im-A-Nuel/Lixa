"use client";

import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";

export default function Header(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isConnected } = useAccount();

  return (
    <>
      {/* Floating centered glass header */}
      <div className="fixed left-1/2 top-4 z-50 w-full max-w-7xl -translate-x-1/2 px-4">
        {/* wrapper relative untuk menempatkan background layer (blur) di belakang */}
        <div className="relative mx-auto w-full rounded-2xl">
          {/* BACKGROUND LAYER: blur + semi-transparent */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl border border-white/10
                       bg-white/10 dark:bg-slate-900/40 backdrop-blur-xl
                       pointer-events-none"
          />

          {/* CONTENT LAYER: berada di atas, tidak akan ter-blur */}
          <header
            className="relative z-10 px-4 py-3 flex items-center justify-between gap-4"
            role="banner"
          >
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center">
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                  Lixa
                </h1>
              </Link>

              <nav
                className="hidden md:flex gap-4"
                aria-label="Primary navigation"
              >
                <Link href="/marketplace" className="text-sm text-gray-200/90">
                  Marketplace
                </Link>
                <Link href="/pools" className="text-sm text-gray-200/90">
                  Pools
                </Link>
                <Link
                  href="/fractionalize"
                  className="text-sm text-gray-200/90"
                >
                  Fractionalize
                </Link>
                <Link href="/licenses" className="text-sm text-gray-200/90">
                  Licenses
                </Link>
                <Link href="/create" className="text-sm text-gray-200/90">
                  Create
                </Link>
                <Link href="/portfolio" className="text-sm text-gray-200/90">
                  Portfolio
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3">
                <ConnectButton showBalance={false} />
              </div>

              <button
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md"
                onClick={() => setMobileOpen((s) => !s)}
              >
                {/* svg */}
              </button>
            </div>
          </header>
        </div>
      </div>

      {/* Mobile nav ... (tetap bisa diletakkan di atas, tanpa perubahan) */}
      {mobileOpen && (
        /* ...mobile nav code sama seperti sebelumnya... */
        <div className="fixed left-1/2 top-[76px] z-40 w-full max-w-7xl -translate-x-1/2 px-4">
          <div className="mx-auto mt-2 rounded-xl border border-white/8 bg-white/10 dark:bg-slate-900/20 backdrop-blur-md px-4 py-3">
            {/* ...links dan ConnectButton */}
          </div>
        </div>
      )}
    </>
  );
}
