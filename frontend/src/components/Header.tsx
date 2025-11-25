"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Header() {
  const pathname = usePathname();

  const nav = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/create", label: "Create" },
    { href: "/portfolio", label: "Portfolio" },
  ];

  return (
    <div className="fixed inset-x-0 top-6 flex justify-center pointer-events-none z-50">
      <div className="pointer-events-auto w-full max-w-5xl px-4">
        <div className="glass-header relative rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl bg-white/5">
          <div className="flex items-center justify-between gap-6 px-6 py-3">
            {/* Left : Logo + Title */}
            <div className="flex items-center gap-4">
              <img
                src="/mnt/data/8835ddcd-0d09-44ca-b26b-63b91c15869f.png"
                alt="logo"
                className="w-9 h-9 object-cover rounded-md"
              />
              <h1 className="text-white font-semibold text-lg">Lixa</h1>
            </div>

            {/* Center : Navigation */}
            <nav className="hidden sm:flex items-center gap-3 relative">
              {nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="relative px-4 py-2 rounded-lg font-medium transition text-sm"
                  >
                    <span
                      className={`absolute inset-0 -z-10 rounded-lg transition-all duration-300 ${
                        active
                          ? "opacity-100 scale-100 nav-pill"
                          : "opacity-0 scale-90"
                      }`}
                    />
                    <span
                      className={
                        active ? "text-white" : "text-gray-300 hover:text-white"
                      }
                    >
                      {n.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Right : Wallet Button */}
            <div>
              <ConnectButton chainStatus="icon" showBalance={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
