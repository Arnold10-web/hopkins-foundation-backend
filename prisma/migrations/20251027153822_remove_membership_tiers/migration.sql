-- First, check if stripeId column exists and rename it, otherwise create paymentId
DO $$
BEGIN
    -- Try to rename stripeId to paymentId if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'donations' AND column_name = 'stripeId'
    ) THEN
        ALTER TABLE "donations" RENAME COLUMN "stripeId" TO "paymentId";
    END IF;
    
    -- If paymentId doesn't exist yet, create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'donations' AND column_name = 'paymentId'
    ) THEN
        ALTER TABLE "donations" ADD COLUMN "paymentId" TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS "donations_paymentId_key" ON "donations"("paymentId");
    END IF;
END $$;

-- AlterTable: Remove membershipTier from users if it exists
ALTER TABLE "users" DROP COLUMN IF EXISTS "membershipTier";

-- AlterTable: Remove isExclusive from stories if it exists
ALTER TABLE "stories" DROP COLUMN IF EXISTS "isExclusive";

-- AlterTable: Remove isExclusive from events if it exists
ALTER TABLE "events" DROP COLUMN IF EXISTS "isExclusive";
