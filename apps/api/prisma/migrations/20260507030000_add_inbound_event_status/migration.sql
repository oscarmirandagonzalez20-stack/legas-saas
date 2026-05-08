-- CreateEnum
CREATE TYPE "InboundEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- DropIndex
DROP INDEX "inbound_events_processed_at_idx";

-- AlterTable: add status + processing_started_at + updated_at (with safe default for existing rows)
ALTER TABLE "inbound_events"
  ADD COLUMN "processing_started_at" TIMESTAMP(3),
  ADD COLUMN "status" "InboundEventStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Remove the bootstrap default so Prisma @updatedAt manages it going forward
ALTER TABLE "inbound_events" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "inbound_events_status_idx" ON "inbound_events"("status");

-- CreateIndex
CREATE INDEX "inbound_events_processing_started_at_idx" ON "inbound_events"("processing_started_at");
