import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { formatEther } from "viem";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ftAddress = searchParams.get("ftAddress");
    const poolId = searchParams.get("poolId");
    const addressLc = ftAddress?.toLowerCase();

    if (!ftAddress) {
      return NextResponse.json(
        { error: "ftAddress parameter is required" },
        { status: 400 }
      );
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch today's trading statistics
    const stats = await prisma.tradeStatistics.findFirst({
      where: {
        ftAddress: addressLc,
        date: {
          gte: today,
        },
        ...(poolId ? { poolId } : {}),
      },
    });

    // Fetch matches for this token to calculate volumes and prices
    const matches = await prisma.orderMatch.findMany({
      where: {
        status: {
          in: ["SETTLED", "SETTLEMENT_EXECUTED"],
        },
        buyOrder: {
          ftAddress: addressLc,
          ...(poolId ? { poolId } : {}),
        },
      },
      include: {
        buyOrder: true,
        sellOrder: true,
      },
      orderBy: [
        { settledAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Calculate statistics
    let highPrice = "0";
    let lowPrice = "0";
    let lastPrice = "0";
    let dailyVolume = "0";
    let totalMatches = 0;
    let totalTrades = 0;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    const dailyMatches = matches.filter((m) => {
      const t = m.settledAt || m.createdAt;
      return t >= cutoff;
    });

    if (matches.length > 0) {
      // Prices from full history (latest match first)
      lastPrice = formatEther(BigInt(matches[0].matchedPrice));
      highPrice = formatEther(matches.reduce((acc, m) => {
        const p = BigInt(m.matchedPrice);
        return p > acc ? p : acc;
      }, BigInt(matches[0].matchedPrice)));
      lowPrice = formatEther(matches.reduce((acc, m) => {
        const p = BigInt(m.matchedPrice);
        return p < acc ? p : acc;
      }, BigInt(matches[0].matchedPrice)));

      // 24h volume from recent matches; fallback to stats if none
      const source = dailyMatches.length > 0 ? dailyMatches : matches;
      let totalVolume = BigInt(0);
      source.forEach((m) => {
        const volume = (BigInt(m.matchedAmount) * BigInt(m.matchedPrice)) / BigInt(1e18);
        totalVolume += volume;
      });
      dailyVolume = formatEther(totalVolume);

      totalMatches = matches.length;
      totalTrades = matches.length;
    } else if (stats) {
      highPrice = stats.highPrice;
      lowPrice = stats.lowPrice;
      lastPrice = stats.lastPrice;
      dailyVolume = stats.dailyVolume;
      totalMatches = stats.totalMatches;
      totalTrades = stats.totalTrades;
    }

    // Calculate change percent:
    // - Prefer last 24h window if it has at least 2 trades
    // - Otherwise fall back to full history if we have at least 2 trades total
    // - Else no change (0)
    let changePercent = 0;
    if (dailyMatches.length > 1) {
      const latest = parseFloat(formatEther(BigInt(dailyMatches[0].matchedPrice)));
      const oldest = parseFloat(formatEther(BigInt(dailyMatches[dailyMatches.length - 1].matchedPrice)));
      if (oldest > 0) {
        changePercent = ((latest - oldest) / oldest) * 100;
      }
    } else if (matches.length > 1) {
      const latest = parseFloat(formatEther(BigInt(matches[0].matchedPrice)));
      const oldest = parseFloat(formatEther(BigInt(matches[matches.length - 1].matchedPrice)));
      if (oldest > 0) {
        changePercent = ((latest - oldest) / oldest) * 100;
      }
    } else if (stats) {
      const prevPrice = parseFloat(stats.lastPrice || "0");
      const currPrice = parseFloat(lastPrice);
      if (prevPrice > 0) {
        changePercent = ((currPrice - prevPrice) / prevPrice) * 100;
      }
    }

    return NextResponse.json({
      ftAddress,
      highPrice,
      lowPrice,
      lastPrice,
      dailyVolume,
      totalMatches,
      totalTrades,
      changePercent: parseFloat(changePercent.toFixed(2)),
      address: addressLc,
    });
  } catch (error) {
    console.error("Error fetching token stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch token stats" },
      { status: 500 }
    );
  }
}
