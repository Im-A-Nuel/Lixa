-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "ftAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "pricePerToken" TEXT NOT NULL,
    "totalValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "filledAmount" TEXT NOT NULL DEFAULT '0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "signature" TEXT,
    "nonce" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "OrderMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyOrderId" TEXT NOT NULL,
    "sellOrderId" TEXT NOT NULL,
    "matchedAmount" TEXT NOT NULL,
    "matchedPrice" TEXT NOT NULL,
    "gasFeePercentage" DECIMAL NOT NULL DEFAULT 0.001,
    "gasFeeAmount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderMatch_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderMatch_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FractionalToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "ftAddress" TEXT NOT NULL,
    "ftName" TEXT NOT NULL,
    "ftSymbol" TEXT NOT NULL,
    "assetId" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradeStatistics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "ftAddress" TEXT NOT NULL,
    "dailyVolume" TEXT NOT NULL DEFAULT '0',
    "highPrice" TEXT NOT NULL DEFAULT '0',
    "lowPrice" TEXT NOT NULL DEFAULT '0',
    "lastPrice" TEXT NOT NULL DEFAULT '0',
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" INTEGER NOT NULL,
    "buyer" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderId_key" ON "Order"("orderId");

-- CreateIndex
CREATE INDEX "Order_userAddress_idx" ON "Order"("userAddress");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_side_idx" ON "Order"("side");

-- CreateIndex
CREATE INDEX "Order_poolId_idx" ON "Order"("poolId");

-- CreateIndex
CREATE INDEX "Order_chainId_idx" ON "Order"("chainId");

-- CreateIndex
CREATE INDEX "OrderMatch_status_idx" ON "OrderMatch"("status");

-- CreateIndex
CREATE INDEX "OrderMatch_buyOrderId_idx" ON "OrderMatch"("buyOrderId");

-- CreateIndex
CREATE INDEX "OrderMatch_sellOrderId_idx" ON "OrderMatch"("sellOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMatch_buyOrderId_sellOrderId_key" ON "OrderMatch"("buyOrderId", "sellOrderId");

-- CreateIndex
CREATE INDEX "OrderHistory_orderId_idx" ON "OrderHistory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "FractionalToken_poolId_key" ON "FractionalToken"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "FractionalToken_ftAddress_key" ON "FractionalToken"("ftAddress");

-- CreateIndex
CREATE UNIQUE INDEX "FractionalToken_ftSymbol_key" ON "FractionalToken"("ftSymbol");

-- CreateIndex
CREATE INDEX "FractionalToken_ftSymbol_idx" ON "FractionalToken"("ftSymbol");

-- CreateIndex
CREATE INDEX "FractionalToken_ftAddress_idx" ON "FractionalToken"("ftAddress");

-- CreateIndex
CREATE INDEX "FractionalToken_poolId_idx" ON "FractionalToken"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeStatistics_ftAddress_date_key" ON "TradeStatistics"("ftAddress", "date");

-- CreateIndex
CREATE INDEX "TradeStatistics_poolId_idx" ON "TradeStatistics"("poolId");

-- CreateIndex
CREATE INDEX "TradeStatistics_ftAddress_idx" ON "TradeStatistics"("ftAddress");

-- CreateIndex
CREATE INDEX "License_buyer_idx" ON "License"("buyer");

-- CreateIndex
CREATE INDEX "License_assetId_idx" ON "License"("assetId");

-- CreateIndex
CREATE INDEX "License_status_idx" ON "License"("status");

-- CreateIndex
CREATE UNIQUE INDEX "License_assetId_buyer_key" ON "License"("assetId", "buyer");
