/*
  Warnings:

  - Added the required column `ipfsCid` to the `Asset` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" INTEGER,
    "creator" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "ipfsHash" TEXT,
    "metadataURI" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Asset" ("assetId", "createdAt", "creator", "fileHash", "fileName", "fileSize", "id", "ipfsHash", "metadataURI", "mimeType", "status", "updatedAt") SELECT "assetId", "createdAt", "creator", "fileHash", "fileName", "fileSize", "id", "ipfsHash", "metadataURI", "mimeType", "status", "updatedAt" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_assetId_key" ON "Asset"("assetId");
CREATE UNIQUE INDEX "Asset_ipfsCid_key" ON "Asset"("ipfsCid");
CREATE INDEX "Asset_creator_idx" ON "Asset"("creator");
CREATE INDEX "Asset_ipfsCid_idx" ON "Asset"("ipfsCid");
CREATE INDEX "Asset_fileHash_idx" ON "Asset"("fileHash");
CREATE INDEX "Asset_status_idx" ON "Asset"("status");
CREATE INDEX "Asset_assetId_idx" ON "Asset"("assetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
