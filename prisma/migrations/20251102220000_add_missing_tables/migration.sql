-- CreateTable: organization_stats (was missing from init migration)
CREATE TABLE "organization_stats" (
    "id" TEXT NOT NULL,
    "livesTransformed" INTEGER NOT NULL DEFAULT 25000,
    "programsActive" INTEGER NOT NULL DEFAULT 150,
    "countriesServed" INTEGER NOT NULL DEFAULT 12,
    "livesChangedGreenSkills" INTEGER NOT NULL DEFAULT 35,
    "womenYouthTrained" INTEGER NOT NULL DEFAULT 125,
    "communitiesReached" INTEGER NOT NULL DEFAULT 12,
    "activeCommunityMembers" INTEGER NOT NULL DEFAULT 85,
    "label" TEXT NOT NULL DEFAULT 'Current',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable: event_registrations (was missing from init migration)
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "confirmationSent" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_eventId_email_key" ON "event_registrations"("eventId", "email");

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix events table - add missing columns
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "endTime" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "featuredImage" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT true;

-- Remove obsolete column
ALTER TABLE "events" DROP COLUMN IF EXISTS "isExclusive";
