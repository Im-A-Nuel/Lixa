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
    <header className="border-b border-gray-800 px-6 py-4 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Lixa
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition ${isActive(link.href) ? "text-white font-medium" : "text-gray-400 hover:text-white"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
