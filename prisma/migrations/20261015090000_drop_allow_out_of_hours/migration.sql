-- Drop the never-enforced out-of-hours toggle.
--
-- `allowOutOfHoursCheckIn` was stored, rendered in the settings form, and read
-- by nothing: no code path consulted it before accepting a check-in. Rather than
-- ship a switch that appears to work but does not, the column is removed and the
-- policy moves to "check-in is always allowed, late is recorded as late".
--
-- Restorable by reverting this migration; no application data is lost, only the
-- unused flag.
ALTER TABLE "settings" DROP COLUMN "allowOutOfHoursCheckIn";