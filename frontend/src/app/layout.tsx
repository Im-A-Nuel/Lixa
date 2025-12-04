import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lixa - License Exchange for Game Assets",
  description:
    "License. Fraction. Earn. - Marketplace for game assets with on-chain licensing and programmable royalties.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
      >
        <Script
          src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js"
          type="module"
          strategy="beforeInteractive"
        />

        {/* Pastikan Providers membungkus Header agar ConnectButton punya konteks */}
        <Providers>
          {/* Beri padding-top supaya konten tidak tertutup floating header.
              Sesuaikan nilai pt-20 / md:pt-28 jika tinggi headermu berbeda */}
          <main className="pt-20 md:pt-28">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
