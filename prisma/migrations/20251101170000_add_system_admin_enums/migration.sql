-- CreateEnum: ActivityLogAction
DO $$ BEGIN
    CREATE TYPE "ActivityLogAction" AS ENUM (
        'LOGIN',
        'LOGOUT',
        'CREATE',
        'UPDATE',
        'DELETE',
        'DONATE',
        'DATABASE_BACKUP',
        'API_ERROR',
        'SETTINGS_CHANGE',
        'USER_REGISTRATION',
        'PASSWORD_RESET',
        'EMAIL_SENT',
        'FILE_UPLOAD',
        'FILE_DELETE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ActivityLogStatus
DO $$ BEGIN
    CREATE TYPE "ActivityLogStatus" AS ENUM (
        'SUCCESS',
        'WARNING',
        'ERROR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ReportType
DO $$ BEGIN
    CREATE TYPE "ReportType" AS ENUM (
        'USER_ACTIVITY',
        'FINANCIAL',
        'SYSTEM_PERFORMANCE',
        'CONTENT',
        'SECURITY',
        'ENGAGEMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ReportStatus
DO $$ BEGIN
    CREATE TYPE "ReportStatus" AS ENUM (
        'PENDING',
        'GENERATING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: SystemHealthStatus
DO $$ BEGIN
    CREATE TYPE "SystemHealthStatus" AS ENUM (
        'OPERATIONAL',
        'DEGRADED',
        'DOWN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Now alter the existing tables to use the enum types instead of TEXT
-- First, we need to convert existing data (if any) and change column types

-- Update activity_logs table
DO $$ BEGIN
    -- Add temporary columns with enum types
    ALTER TABLE "activity_logs" ADD COLUMN "action_enum" "ActivityLogAction";
    ALTER TABLE "activity_logs" ADD COLUMN "status_enum" "ActivityLogStatus";
    
    -- Copy data with casting
    UPDATE "activity_logs" SET "action_enum" = "action"::"ActivityLogAction" WHERE "action" IS NOT NULL;
    UPDATE "activity_logs" SET "status_enum" = "status"::"ActivityLogStatus" WHERE "status" IS NOT NULL;
    
    -- Drop old columns
    ALTER TABLE "activity_logs" DROP COLUMN "action";
    ALTER TABLE "activity_logs" DROP COLUMN "status";
    
    -- Rename new columns
    ALTER TABLE "activity_logs" RENAME COLUMN "action_enum" TO "action";
    ALTER TABLE "activity_logs" RENAME COLUMN "status_enum" TO "status";
    
    -- Make action NOT NULL
    ALTER TABLE "activity_logs" ALTER COLUMN "action" SET NOT NULL;
    -- Set default for status
    ALTER TABLE "activity_logs" ALTER COLUMN "status" SET DEFAULT 'SUCCESS'::"ActivityLogStatus";
EXCEPTION
    WHEN others THEN
        -- If columns don't exist or conversion fails, skip
        RAISE NOTICE 'Could not update activity_logs columns: %', SQLERRM;
END $$;

-- Update system_reports table
DO $$ BEGIN
    ALTER TABLE "system_reports" ADD COLUMN "type_enum" "ReportType";
    ALTER TABLE "system_reports" ADD COLUMN "status_enum" "ReportStatus";
    
    UPDATE "system_reports" SET "type_enum" = "type"::"ReportType" WHERE "type" IS NOT NULL;
    UPDATE "system_reports" SET "status_enum" = "status"::"ReportStatus" WHERE "status" IS NOT NULL;
    
    ALTER TABLE "system_reports" DROP COLUMN "type";
    ALTER TABLE "system_reports" DROP COLUMN "status";
    
    ALTER TABLE "system_reports" RENAME COLUMN "type_enum" TO "type";
    ALTER TABLE "system_reports" RENAME COLUMN "status_enum" TO "status";
    
    ALTER TABLE "system_reports" ALTER COLUMN "type" SET NOT NULL;
    ALTER TABLE "system_reports" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ReportStatus";
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update system_reports columns: %', SQLERRM;
END $$;

-- Update system_health table
DO $$ BEGIN
    ALTER TABLE "system_health" ADD COLUMN "status_enum" "SystemHealthStatus";
    
    UPDATE "system_health" SET "status_enum" = "status"::"SystemHealthStatus" WHERE "status" IS NOT NULL;
    
    ALTER TABLE "system_health" DROP COLUMN "status";
    
    ALTER TABLE "system_health" RENAME COLUMN "status_enum" TO "status";
    
    ALTER TABLE "system_health" ALTER COLUMN "status" SET DEFAULT 'OPERATIONAL'::"SystemHealthStatus";
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update system_health columns: %', SQLERRM;
END $$;
