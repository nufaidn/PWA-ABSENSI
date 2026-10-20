-- Update work schedules to new times:
-- Senin-Jumat: 08:00 - 16:00
-- Sabtu: 08:00 - 14:00

-- Update or create the main work schedule (Senin-Jumat)
UPDATE "work_schedules"
SET 
  "name" = 'Jam Kerja Reguler (Senin-Jumat)',
  "startTime" = '08:00',
  "endTime" = '16:00',
  "lateToleranceMinutes" = 10,
  "breakMinutes" = 60,
  "isDefault" = true,
  "updatedAt" = NOW()
WHERE "name" = 'Jam Kerja Reguler' OR "id" = (
  SELECT "id" FROM "work_schedules" 
  WHERE "isOrganizationDefault" = true 
  LIMIT 1
);

-- Update Shift Pagi to align with 08:00-16:00 schedule (for those starting earlier)
UPDATE "work_schedules"
SET 
  "name" = 'Shift Pagi (Senin-Jumat)',
  "startTime" = '06:00',
  "endTime" = '14:00',
  "lateToleranceMinutes" = 10,
  "breakMinutes" = 45,
  "updatedAt" = NOW()
WHERE "name" = 'Shift Pagi';

-- Update Shift Malam to become Shift Siang
UPDATE "work_schedules"
SET 
  "name" = 'Shift Siang (Senin-Jumat)',
  "startTime" = '08:00',
  "endTime" = '16:00',
  "lateToleranceMinutes" = 10,
  "breakMinutes" = 60,
  "updatedAt" = NOW()
WHERE "name" = 'Shift Malam';

-- Delete the Part-time schedule if it exists (optional, can be commented out)
-- DELETE FROM "work_schedules" WHERE "name" = 'Karyawan Part-time';

-- Insert Saturday schedule if it doesn't exist
INSERT INTO "work_schedules" 
  ("id", "name", "startTime", "endTime", "lateToleranceMinutes", "breakMinutes", "isDefault", "isActive", "isOrganizationDefault", "createdAt", "updatedAt")
SELECT 
  'schedule_saturday_' || gen_random_uuid()::text,
  'Jam Kerja Sabtu',
  '08:00',
  '14:00',
  10,
  45,
  false,
  true,
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "work_schedules" WHERE "name" = 'Jam Kerja Sabtu'
);
