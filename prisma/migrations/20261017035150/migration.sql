-- DropForeignKey
ALTER TABLE "work_schedule_days" DROP CONSTRAINT "work_schedule_days_scheduleId_fkey";

-- DropIndex
DROP INDEX "work_schedule_days_scheduleId_idx";

-- AddForeignKey
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
