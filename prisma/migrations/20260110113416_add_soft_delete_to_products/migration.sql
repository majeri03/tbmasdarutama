-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_supplierId_idx" ON "products"("supplierId");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");
