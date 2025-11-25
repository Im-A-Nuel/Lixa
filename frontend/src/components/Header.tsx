"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useRef } from "react";

export default function Header() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLDivElement | null>(null);

  const nav = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/create", label: "Create" },
    { href: "/portfolio", label: "Portfolio" },
  ];

  // measure header height and set CSS var so layout can use it
  useEffect(() => {
    if (!headerRef.current) return;

    const el = headerRef.current;

    const setVar = () => {
      const rect = el.getBoundingClientRect();
      // add top offset (top:24px from top-6) so reserved space = offset + header height
      const topOffset = 24; // px - matches top-6
      const total = Math.ceil(rect.height + topOffset);
      document.documentElement.style.setProperty(
        "--header-height",
        `${total}px`
      );
    };

    // initial
    setVar();

    // use ResizeObserver so changes to header content update var
    const ro = new ResizeObserver(() => setVar());
    ro.observe(el);

    // also update on window resize (for fonts / layout)
    window.addEventListener("resize", setVar);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", setVar);
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-6 flex justify-center pointer-events-none z-50"
      aria-hidden={false}
    >
      {/* use same max-w as content so width matches */}
      <div
        className="pointer-events-auto w-full max-w-7xl px-6"
        ref={headerRef}
      >
        <div className="glass-header relative rounded-2xl border border-white/10 shadow-2xl bg-white/5">
          {/* header inner: auto height (no fixed h-14) so it can grow if needed */}
          <div className="flex items-center justify-between gap-6 px-4 py-3">
            {/* Left: logo + title */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent"
              >
                Lixa
              </Link>
            </div>

            {/* Center: nav */}
            <nav className="hidden sm:flex items-center gap-3 relative">
              {nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`relative px-4 py-2 rounded-lg font-medium transition text-sm flex items-center justify-center ${
                      active ? "nav-active" : "bg-transparent text-gray-300"
                    }`}
                  >
                    {/* nav background pill (handled in CSS) */}
                    <span
                      aria-hidden
                      className={`absolute inset-0 -z-10 rounded-lg transition-all duration-300 ${
                        active ? "nav-pill-active" : "nav-pill-inactive"
                      }`}
                    />
                    <span
                      className={
                        active ? "nav-text-active" : "nav-text-inactive"
                      }
                    >
                      {n.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: wallet */}
            <div className="right">
              {/* wrapper untuk styling tombol RainbowKit */}
              <div className="wallet-wrap" aria-hidden={false}>
                <ConnectButton chainStatus="icon" showBalance={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
