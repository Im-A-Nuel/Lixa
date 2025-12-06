"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function MarketplaceNav() {
  const pathname = usePathname();

  const links = [
    { href: "/marketplace", label: "License Market" },
    { href: "/pools", label: "Primary Market" },
    { href: "/secondary-market", label: "Secondary Market" },
    { href: "/create", label: "Create" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/trade-history", label: "Trade History" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="px-6 py-4 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto bg-[#1a1a24]/80 backdrop-blur-md border border-gray-700/50 rounded-2xl px-6 py-3 flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent hover:opacity-80 transition">
            Lixa
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition ${isActive(link.href) ? "text-white font-medium" : "text-gray-300 hover:text-white"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="connect-wallet-btn flex-shrink-0">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
