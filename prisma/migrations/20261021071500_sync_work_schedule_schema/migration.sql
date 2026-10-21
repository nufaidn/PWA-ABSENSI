-- Add the description column that `WorkSchedule` has always declared in the
-- Prisma schema but that was missing from the initial migration.
ALTER TABLE "work_schedules" ADD COLUMN "description" TEXT;

-- Per-day schedule rows. The current UI reads the denormalized times on
-- `work_schedules`, but the relation is part of the schema and keeps the door
-- open for true per-day schedules.
CREATE TABLE "work_schedule_days" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_schedule_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_schedule_days_scheduleId_dayOfWeek_key"
    ON "work_schedule_days"("scheduleId", "dayOfWeek");

ALTER TABLE "work_schedule_days"
    ADD CONSTRAINT "work_schedule_days_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "work_schedules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Legacy duplicate of `isOrganizationDefault`. The application never read this
-- column; dropping it makes the database match the Prisma schema exactly.
ALTER TABLE "work_schedules" DROP COLUMN "isDefault";
