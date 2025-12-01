import { PrismaClient } from "@prisma/client";
import { formatEther, parseEther } from "viem";

type RecordTradeParams = {
  ftAddress: string;
  poolId: string;
  matchedAmountWei: string;
  matchedPriceWei: string;
};

/**
 * Update TradeStatistics for a settled match.
 * Stores prices/volume in ETH string form for easy display.
 */
export async function recordTradeStats(prisma: PrismaClient, params: RecordTradeParams) {
  const { ftAddress, poolId, matchedAmountWei, matchedPriceWei } = params;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const matchedPriceEth = formatEther(BigInt(matchedPriceWei));
  const volumeWei = (BigInt(matchedAmountWei) * BigInt(matchedPriceWei)) / BigInt(1e18);
  const volumeEth = formatEther(volumeWei);

  const existing = await prisma.tradeStatistics.findFirst({
    where: {
      ftAddress,
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  if (!existing) {
    await prisma.tradeStatistics.create({
      data: {
        ftAddress,
        poolId,
        date: today,
        highPrice: matchedPriceEth,
        lowPrice: matchedPriceEth,
        lastPrice: matchedPriceEth,
        dailyVolume: volumeEth,
        totalTrades: 1,
        totalMatches: 1,
      },
    });
    return;
  }

  const prevHighWei = parseEther(existing.highPrice || "0");
  const prevLowWei = existing.lowPrice ? parseEther(existing.lowPrice) : null;
  const prevVolumeWei = parseEther(existing.dailyVolume || "0");

  const newHighWei = prevHighWei > BigInt(matchedPriceWei) ? prevHighWei : BigInt(matchedPriceWei);
  const newLowWei =
    prevLowWei === null
      ? BigInt(matchedPriceWei)
      : prevLowWei < BigInt(matchedPriceWei)
        ? prevLowWei
        : BigInt(matchedPriceWei);

  const newVolumeWei = prevVolumeWei + volumeWei;

  await prisma.tradeStatistics.update({
    where: { id: existing.id },
    data: {
      highPrice: formatEther(newHighWei),
      lowPrice: formatEther(newLowWei),
      lastPrice: matchedPriceEth,
      dailyVolume: formatEther(newVolumeWei),
      totalTrades: existing.totalTrades + 1,
      totalMatches: existing.totalMatches + 1,
    },
  });
}
