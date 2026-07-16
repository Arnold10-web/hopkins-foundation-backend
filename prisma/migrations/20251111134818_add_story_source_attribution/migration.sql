-- AlterTable
ALTER TABLE "stories" ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "sourceAuthor" TEXT,
ADD COLUMN "sourceDate" TIMESTAMP(3);
