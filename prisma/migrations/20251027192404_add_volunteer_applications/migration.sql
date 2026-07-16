-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "volunteer_applications" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "education" TEXT,
    "currentOccupation" TEXT,
    "skills" TEXT[],
    "experience" TEXT,
    "position" TEXT NOT NULL,
    "availability" TEXT,
    "startDate" TIMESTAMP(3),
    "motivation" TEXT NOT NULL,
    "previousVolunteer" BOOLEAN NOT NULL DEFAULT false,
    "previousVolunteerDetails" TEXT,
    "languages" TEXT[],
    "references" TEXT,
    "resume" TEXT,
    "linkedIn" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "volunteer_applications_status_idx" ON "volunteer_applications"("status");
CREATE INDEX "volunteer_applications_email_idx" ON "volunteer_applications"("email");
CREATE INDEX "volunteer_applications_createdAt_idx" ON "volunteer_applications"("createdAt");
