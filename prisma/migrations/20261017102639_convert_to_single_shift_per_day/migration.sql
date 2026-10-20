-- Convert work schedule to single-shift per-day system
-- Step 1: Create new work_schedule_days table
CREATE TABLE "work_schedule_days" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scheduleId" TEXT NOT NULL,
  "dayOfWeek" SMALLINT NOT NULL,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT "work_schedule_days_scheduleId_fkey" FOREIGN KEY ("scheduleId") 
    REFERENCES "work_schedules" ("id") ON DELETE CASCADE,
  CONSTRAINT "work_schedule_days_scheduleId_dayOfWeek_key" UNIQUE ("scheduleId", "dayOfWeek")
);

-- Step 2: Drop old columns from work_schedules
ALTER TABLE "work_schedules" 
  DROP COLUMN IF EXISTS "breakMinutes",
  DROP COLUMN IF EXISTS "startTime",
  DROP COLUMN IF EXISTS "endTime",
  DROP COLUMN IF EXISTS "lateToleranceMinutes",
  DROP COLUMN IF EXISTS "isDefault",
  ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Step 3: Add description if new schedules are created
-- Step 4: Populate work_schedule_days for existing schedules with Monday-Friday
-- Get the default schedule and create entries for Monday-Friday (1-5)
INSERT INTO "work_schedule_days" 
  ("id", "scheduleId", "dayOfWeek", "startTime", "endTime", "lateToleranceMinutes", "isWorkingDay")
SELECT 
  gen_random_uuid()::text,
  "id",
  days.day,
  '08:00',
  '16:00',
  10,
  true
FROM "work_schedules" ws
CROSS JOIN LATERAL (SELECT UNNEST(ARRAY[1,2,3,4,5]) as day) days
WHERE NOT EXISTS (
  SELECT 1 FROM "work_schedule_days" 
  WHERE "scheduleId" = ws."id"
);

-- Step 5: Add weekend entries (Saturday=6, Sunday=0) as non-working days
INSERT INTO "work_schedule_days"
  ("id", "scheduleId", "dayOfWeek", "startTime", "endTime", "lateToleranceMinutes", "isWorkingDay")
SELECT 
  gen_random_uuid()::text,
  "id",
  days.day,
  '00:00',
  '00:00',
  0,
  false
FROM "work_schedules" ws
CROSS JOIN LATERAL (SELECT UNNEST(ARRAY[0,6]) as day) days
WHERE NOT EXISTS (
  SELECT 1 FROM "work_schedule_days"
  WHERE "scheduleId" = ws."id" AND "dayOfWeek" = days.day
);

-- Create index for better query performance
CREATE INDEX "work_schedule_days_scheduleId_idx" ON "work_schedule_days" ("scheduleId");
