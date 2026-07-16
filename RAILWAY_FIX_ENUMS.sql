-- CRITICAL FIX: Add missing enum types for System Admin features
-- Run this directly in Railway's PostgreSQL database console

-- Step 1: Create all required enum types
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
    WHEN duplicate_object THEN 
        RAISE NOTICE 'ActivityLogAction enum already exists, skipping.';
END $$;

DO $$ BEGIN
    CREATE TYPE "ActivityLogStatus" AS ENUM (
        'SUCCESS',
        'WARNING',
        'ERROR'
    );
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'ActivityLogStatus enum already exists, skipping.';
END $$;

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
    WHEN duplicate_object THEN 
        RAISE NOTICE 'ReportType enum already exists, skipping.';
END $$;

DO $$ BEGIN
    CREATE TYPE "ReportStatus" AS ENUM (
        'PENDING',
        'GENERATING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'ReportStatus enum already exists, skipping.';
END $$;

DO $$ BEGIN
    CREATE TYPE "SystemHealthStatus" AS ENUM (
        'OPERATIONAL',
        'DEGRADED',
        'DOWN'
    );
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'SystemHealthStatus enum already exists, skipping.';
END $$;

-- Step 2: Update activity_logs table to use enum types
DO $$ 
DECLARE
    v_has_action_column boolean;
    v_action_type text;
BEGIN
    -- Check if action column exists and get its type
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activity_logs' AND column_name = 'action'
    ) INTO v_has_action_column;
    
    IF v_has_action_column THEN
        SELECT data_type INTO v_action_type
        FROM information_schema.columns 
        WHERE table_name = 'activity_logs' AND column_name = 'action';
        
        -- Only convert if it's currently TEXT
        IF v_action_type = 'text' THEN
            RAISE NOTICE 'Converting activity_logs columns to enum types...';
            
            -- Handle action column
            ALTER TABLE "activity_logs" ADD COLUMN "action_enum" "ActivityLogAction";
            UPDATE "activity_logs" SET "action_enum" = "action"::"ActivityLogAction" WHERE "action" IS NOT NULL;
            ALTER TABLE "activity_logs" DROP COLUMN "action";
            ALTER TABLE "activity_logs" RENAME COLUMN "action_enum" TO "action";
            ALTER TABLE "activity_logs" ALTER COLUMN "action" SET NOT NULL;
            
            -- Handle status column
            ALTER TABLE "activity_logs" ADD COLUMN "status_enum" "ActivityLogStatus";
            UPDATE "activity_logs" SET "status_enum" = COALESCE("status"::"ActivityLogStatus", 'SUCCESS'::"ActivityLogStatus");
            ALTER TABLE "activity_logs" DROP COLUMN "status";
            ALTER TABLE "activity_logs" RENAME COLUMN "status_enum" TO "status";
            ALTER TABLE "activity_logs" ALTER COLUMN "status" SET DEFAULT 'SUCCESS'::"ActivityLogStatus";
            ALTER TABLE "activity_logs" ALTER COLUMN "status" SET NOT NULL;
            
            RAISE NOTICE 'activity_logs table updated successfully.';
        ELSE
            RAISE NOTICE 'activity_logs already uses enum types, skipping.';
        END IF;
    END IF;
END $$;

-- Step 3: Update system_reports table to use enum types
DO $$ 
DECLARE
    v_has_type_column boolean;
    v_type_type text;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'system_reports' AND column_name = 'type'
    ) INTO v_has_type_column;
    
    IF v_has_type_column THEN
        SELECT data_type INTO v_type_type
        FROM information_schema.columns 
        WHERE table_name = 'system_reports' AND column_name = 'type';
        
        IF v_type_type = 'text' THEN
            RAISE NOTICE 'Converting system_reports columns to enum types...';
            
            ALTER TABLE "system_reports" ADD COLUMN "type_enum" "ReportType";
            UPDATE "system_reports" SET "type_enum" = "type"::"ReportType" WHERE "type" IS NOT NULL;
            ALTER TABLE "system_reports" DROP COLUMN "type";
            ALTER TABLE "system_reports" RENAME COLUMN "type_enum" TO "type";
            ALTER TABLE "system_reports" ALTER COLUMN "type" SET NOT NULL;
            
            ALTER TABLE "system_reports" ADD COLUMN "status_enum" "ReportStatus";
            UPDATE "system_reports" SET "status_enum" = COALESCE("status"::"ReportStatus", 'PENDING'::"ReportStatus");
            ALTER TABLE "system_reports" DROP COLUMN "status";
            ALTER TABLE "system_reports" RENAME COLUMN "status_enum" TO "status";
            ALTER TABLE "system_reports" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ReportStatus";
            ALTER TABLE "system_reports" ALTER COLUMN "status" SET NOT NULL;
            
            RAISE NOTICE 'system_reports table updated successfully.';
        ELSE
            RAISE NOTICE 'system_reports already uses enum types, skipping.';
        END IF;
    END IF;
END $$;

-- Step 4: Update system_health table to use enum types
DO $$ 
DECLARE
    v_has_status_column boolean;
    v_status_type text;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'system_health' AND column_name = 'status'
    ) INTO v_has_status_column;
    
    IF v_has_status_column THEN
        SELECT data_type INTO v_status_type
        FROM information_schema.columns 
        WHERE table_name = 'system_health' AND column_name = 'status';
        
        IF v_status_type = 'text' THEN
            RAISE NOTICE 'Converting system_health columns to enum types...';
            
            ALTER TABLE "system_health" ADD COLUMN "status_enum" "SystemHealthStatus";
            UPDATE "system_health" SET "status_enum" = COALESCE("status"::"SystemHealthStatus", 'OPERATIONAL'::"SystemHealthStatus");
            ALTER TABLE "system_health" DROP COLUMN "status";
            ALTER TABLE "system_health" RENAME COLUMN "status_enum" TO "status";
            ALTER TABLE "system_health" ALTER COLUMN "status" SET DEFAULT 'OPERATIONAL'::"SystemHealthStatus";
            ALTER TABLE "system_health" ALTER COLUMN "status" SET NOT NULL;
            
            RAISE NOTICE 'system_health table updated successfully.';
        ELSE
            RAISE NOTICE 'system_health already uses enum types, skipping.';
        END IF;
    END IF;
END $$;

-- Verification
SELECT 
    'Enum types created successfully!' as status,
    (SELECT count(*) FROM pg_type WHERE typname = 'ActivityLogAction') as ActivityLogAction,
    (SELECT count(*) FROM pg_type WHERE typname = 'ActivityLogStatus') as ActivityLogStatus,
    (SELECT count(*) FROM pg_type WHERE typname = 'ReportType') as ReportType,
    (SELECT count(*) FROM pg_type WHERE typname = 'ReportStatus') as ReportStatus,
    (SELECT count(*) FROM pg_type WHERE typname = 'SystemHealthStatus') as SystemHealthStatus;

-- Show column types
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name IN ('activity_logs', 'system_reports', 'system_health')
    AND column_name IN ('action', 'status', 'type')
ORDER BY table_name, column_name;
