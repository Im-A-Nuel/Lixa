-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "canonicalFormat" TEXT;
ALTER TABLE "Asset" ADD COLUMN "canonicalHeight" INTEGER;
ALTER TABLE "Asset" ADD COLUMN "canonicalWidth" INTEGER;
ALTER TABLE "Asset" ADD COLUMN "perceptualHash" TEXT;
ALTER TABLE "Asset" ADD COLUMN "perceptualType" TEXT;

-- CreateIndex
CREATE INDEX "Asset_perceptualHash_idx" ON "Asset"("perceptualHash");

-- CreateIndex
CREATE INDEX "Asset_mimeType_idx" ON "Asset"("mimeType");
