-- AlterTable
ALTER TABLE "stories" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "programs" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
