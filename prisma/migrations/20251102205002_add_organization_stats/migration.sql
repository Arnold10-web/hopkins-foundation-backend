-- CreateTable
CREATE TABLE "OrganizationStats" (
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

    CONSTRAINT "OrganizationStats_pkey" PRIMARY KEY ("id")
);
