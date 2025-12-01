-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_License" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" INTEGER NOT NULL,
    "buyer" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL DEFAULT 'NON_EXCLUSIVE',
    "price" TEXT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_License" ("assetId", "buyer", "createdAt", "expiresAt", "id", "price", "status", "txHash", "updatedAt") SELECT "assetId", "buyer", "createdAt", "expiresAt", "id", "price", "status", "txHash", "updatedAt" FROM "License";
DROP TABLE "License";
ALTER TABLE "new_License" RENAME TO "License";
CREATE INDEX "License_buyer_idx" ON "License"("buyer");
CREATE INDEX "License_assetId_idx" ON "License"("assetId");
CREATE INDEX "License_status_idx" ON "License"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
