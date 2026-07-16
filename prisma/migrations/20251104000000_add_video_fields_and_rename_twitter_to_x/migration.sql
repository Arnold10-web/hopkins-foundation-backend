-- AlterTable
ALTER TABLE "stories" ADD COLUMN "featuredVideo" TEXT;

-- AlterTable
ALTER TABLE "programs" ADD COLUMN "featuredVideo" TEXT;

-- AlterTable
ALTER TABLE "team_members" RENAME COLUMN "twitter" TO "x";
