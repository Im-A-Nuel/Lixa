/**
 * Order Matching Engine - Off-chain order matching dengan gas fee calculation
 * Sistem ini menyerupai bursa saham - hanya charge gas fee ketika transaksi terjadi
 */

export interface OrderMatchRequest {
  buyOrderId: string;
  sellOrderId: string;
  matchAmount: string; // Amount yang akan di-match
}

export interface MatchResult {
  matched: boolean;
  matchedAmount: string;
  matchedPrice: string;
  gasFee: string;
  gasFeePercentage: number;
  totalCost: string;
  message?: string;
}

/**
 * Calculate gas fee berdasarkan matched amount dan price
 * Mirip dengan fee di bursa saham
 */
export function calculateGasFee(
  matchedAmount: string,
  matchedPrice: string,
  gasFeePercentage: number = 0.001 // Default 0.1% (bisa dikonfigurasi)
): string {
  try {
    const amount = BigInt(matchedAmount);
    const price = BigInt(matchedPrice);
    const feeBasisPoints = Math.floor(gasFeePercentage * 10000); // Convert to basis points

    // totalValue = amount * price / 1e18 (karena price dalam wei)
    // fee = totalValue * gasFeePercentage
    const totalValue = (amount * price) / BigInt(1e18);
    const fee = (totalValue * BigInt(feeBasisPoints)) / BigInt(10000);

    return fee.toString();
  } catch (error) {
    console.error("Error calculating gas fee:", error);
    throw new Error("Invalid gas fee calculation");
  }
}

/**
 * Validate if buy order dan sell order bisa di-match
 */
export function validateOrderMatch(
  buyOrder: {
    id: string;
    userAddress: string;
    side: string;
    poolId: string;
    ftAddress: string;
    amount: string;
    filledAmount: string;
    pricePerToken: string;
    status: string;
    expiresAt: Date;
  },
  sellOrder: {
    id: string;
    userAddress: string;
    side: string;
    poolId: string;
    ftAddress: string;
    amount: string;
    filledAmount: string;
    pricePerToken: string;
    status: string;
    expiresAt: Date;
  },
  matchAmount: string
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check order sides
  if (buyOrder.side !== "BUY") {
    errors.push("Buy order must be a BUY order");
  }
  if (sellOrder.side !== "SELL") {
    errors.push("Sell order must be a SELL order");
  }

  // Check same pool and token
  if (buyOrder.poolId !== sellOrder.poolId) {
    errors.push("Orders must be for the same pool");
  }
  if (buyOrder.ftAddress !== sellOrder.ftAddress) {
    errors.push("Orders must be for the same token");
  }

  // Check orders are not expired
  const now = new Date();
  if (buyOrder.expiresAt < now) {
    errors.push("Buy order is expired");
  }
  if (sellOrder.expiresAt < now) {
    errors.push("Sell order is expired");
  }

  // Check orders are open
  if (buyOrder.status === "CANCELLED") {
    errors.push("Buy order is cancelled");
  }
  if (sellOrder.status === "CANCELLED") {
    errors.push("Sell order is cancelled");
  }

  // Check price compatibility
  const buyPrice = BigInt(buyOrder.pricePerToken);
  const sellPrice = BigInt(sellOrder.pricePerToken);
  if (buyPrice < sellPrice) {
    errors.push(
      `Buy price (${buyPrice}) must be >= sell price (${sellPrice})`
    );
  }

  // Check amount available
  const buyAvailable = BigInt(buyOrder.amount) - BigInt(buyOrder.filledAmount);
  const sellAvailable =
    BigInt(sellOrder.amount) - BigInt(sellOrder.filledAmount);
  const toMatch = BigInt(matchAmount);

  if (toMatch > buyAvailable) {
    errors.push(
      `Match amount exceeds buy order available amount: ${toMatch} > ${buyAvailable}`
    );
  }
  if (toMatch > sellAvailable) {
    errors.push(
      `Match amount exceeds sell order available amount: ${toMatch} > ${sellAvailable}`
    );
  }

  // Check same user tidak bisa trade dengan dirinya sendiri
  if (buyOrder.userAddress.toLowerCase() === sellOrder.userAddress.toLowerCase()) {
    errors.push("User cannot trade with themselves");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate effective price (settlement price)
 * Biasanya adalah mid-point antara buy dan sell, atau sell price (lebih menguntungkan pembeli)
 */
export function calculateSettlementPrice(
  buyPrice: string,
  sellPrice: string,
  useSellerPrice: boolean = true
): string {
  try {
    const buyP = BigInt(buyPrice);
    const sellP = BigInt(sellPrice);

    if (useSellerPrice) {
      // Gunakan seller price (lebih fair untuk buyer)
      return sellP.toString();
    } else {
      // Gunakan mid-point
      return ((buyP + sellP) / BigInt(2)).toString();
    }
  } catch (error) {
    console.error("Error calculating settlement price:", error);
    throw new Error("Invalid settlement price calculation");
  }
}

/**
 * Get next available orders to match (simple FIFO matching)
 * Dalam real implementation, bisa lebih sophisticated (best price, time priority, dll)
 */
export function findBestMatch(
  buyOrder: {
    pricePerToken: string;
    amount: string;
    filledAmount: string;
  },
  sellOrders: Array<{
    id: string;
    userAddress: string;
    side: string;
    poolId: string;
    ftAddress: string;
    pricePerToken: string;
    amount: string;
    filledAmount: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
  }>
): (typeof sellOrders)[0] | null {
  // Filter: seller price <= buyer price, dan ada stock available
  const validSellers = sellOrders.filter((order) => {
    const sellPrice = BigInt(order.pricePerToken);
    const buyPrice = BigInt(buyOrder.pricePerToken);
    const available =
      BigInt(order.amount) - BigInt(order.filledAmount) > BigInt(0);

    return sellPrice <= buyPrice && available;
  });

  if (validSellers.length === 0) {
    return null;
  }

  // Sort by: best price first, then oldest first (FIFO by time)
  validSellers.sort((a, b) => {
    const priceCompare =
      BigInt(a.pricePerToken) - BigInt(b.pricePerToken);
    if (priceCompare !== BigInt(0)) {
      return Number(priceCompare);
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return validSellers[0];
}

/**
 * Calculate matching statistics untuk display
 */
export function getMatchingStats(
  orders: Array<{
    side: string;
    amount: string;
    filledAmount: string;
    pricePerToken: string;
  }>
): {
  totalBuyOrders: number;
  totalSellOrders: number;
  totalBuyVolume: string;
  totalSellVolume: string;
  averageBuyPrice: string;
  averageSellPrice: string;
} {
  const buyOrders = orders.filter((o) => o.side === "BUY");
  const sellOrders = orders.filter((o) => o.side === "SELL");

  let totalBuyVol = BigInt(0);
  let totalBuyPrice = BigInt(0);
  let totalSellVol = BigInt(0);
  let totalSellPrice = BigInt(0);

  buyOrders.forEach((order) => {
    const volume = BigInt(order.amount);
    totalBuyVol += volume;
    totalBuyPrice += BigInt(order.pricePerToken) * volume;
  });

  sellOrders.forEach((order) => {
    const volume = BigInt(order.amount);
    totalSellVol += volume;
    totalSellPrice += BigInt(order.pricePerToken) * volume;
  });

  const avgBuyPrice =
    buyOrders.length > 0 ? (totalBuyPrice / BigInt(buyOrders.length)).toString() : "0";
  const avgSellPrice =
    sellOrders.length > 0
      ? (totalSellPrice / BigInt(sellOrders.length)).toString()
      : "0";

  return {
    totalBuyOrders: buyOrders.length,
    totalSellOrders: sellOrders.length,
    totalBuyVolume: totalBuyVol.toString(),
    totalSellVolume: totalSellVol.toString(),
    averageBuyPrice: avgBuyPrice,
    averageSellPrice: avgSellPrice,
  };
}
