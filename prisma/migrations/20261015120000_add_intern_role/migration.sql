-- Add the INTERN ("Magang") role.
--
-- Added at the end of the enum rather than next to EMPLOYEE. In PostgreSQL the
-- order of `CREATE TYPE ... AS ENUM` defines the sort order, and existing rows
-- keep the labels they already have. Appending avoids renumbering anything.
--
-- `INTERN` carries the same application privileges as `EMPLOYEE`; the
-- distinction is organizational (pay grade, contract type), not authorization.
ALTER TYPE "Role" ADD VALUE 'INTERN';