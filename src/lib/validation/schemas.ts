import { z } from "zod";
import { isSelfServiceRole } from "@/lib/attendance/time";

/**
 * Input validation schemas.
 *
 * Every Server Action parses its FormData (or JSON body) through one of these
 * before touching the database. Schemas are the boundary: nothing reaches
 * Prisma without passing through here first.
 */

const trimmedName = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(80, "Nama maksimal 80 karakter.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email wajib diisi.")
  .max(160, "Email terlalu panjang.")
  .email("Format email tidak valid.");

const password = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(128, "Password terlalu panjang.")
  .regex(/[a-zA-Z]/, "Password harus memuat huruf.")
  .regex(/[0-9]/, "Password harus memuat angka.");

/** `"HH:mm"`, the wire format for all schedule times. */
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format waktu harus HH:mm.");

const optionalCode = z
  .string()
  .trim()
  .max(32, "Kode karyawan terlalu panjang.")
  .optional()
  .transform((value) => (value ? value : null));

/**
 * An employee code is the identifier non-administrators sign in with, so it is
 * required for EMPLOYEE and INTERN accounts. Admins sign in with an email
 * address and are not issued a code, so demanding one from them would be noise.
 *
 * Enforced by the `.refine()` on `createEmployeeSchema` / `updateEmployeeSchema`
 * rather than on the field itself — that is what lets an admin legitimately
 * submit a blank code while a non-admin cannot.
 */

const optionalShortText = z
  .string()
  .trim()
  .max(80, "Nilai terlalu panjang.")
  .optional()
  .transform((value) => (value ? value : null));

const roleEnum = z.enum(["EMPLOYEE", "INTERN", "ADMIN", "SUPER_ADMIN"]);

const attendanceStatusEnum = z.enum([
  "PRESENT",
  "LATE",
  "ABSENT",
  "INCOMPLETE",
  "LEAVE",
  "HOLIDAY",
]);

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Tanggal tidak valid.");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Credential entry for both login forms.
 *
 * The same shape is used for employees (who type their employee code) and admins
 * (who type an email address). One field with a neutral name keeps the two forms
 * sharing a single validation path, and the caller decides which label to show.
 */
const identifier = z
  .string()
  .trim()
  .min(1, "ID atau email wajib diisi.")
  .max(160, "Input terlalu panjang.");

export const loginSchema = z.object({
  identifier,
  password: z.string().min(1, "Password wajib diisi.").max(128),
  next: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Same credential check, restricted to accounts that hold ADMIN or above. */
export const adminLoginSchema = z.object({
  identifier,
  password: z.string().min(1, "Password wajib diisi.").max(128),
  next: z.string().optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: password,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export const createEmployeeSchema = z
  .object({
    name: trimmedName,
    email,
    password,
    employeeCode: optionalCode,
    role: roleEnum.default("EMPLOYEE"),
    department: optionalShortText,
    phone: optionalShortText,
    scheduleId: z.string().optional().transform((v) => (v ? v : null)),
  })
  .refine(
    (data) => !isSelfServiceRole(data.role) || Boolean(data.employeeCode),
    {
      message: "ID Karyawan wajib diisi untuk akun karyawan dan magang.",
      path: ["employeeCode"],
    },
  );

export const updateEmployeeSchema = z
  .object({
    name: trimmedName.optional(),
    email: email.optional(),
    employeeCode: optionalCode,
    role: roleEnum.optional(),
    department: optionalShortText,
    phone: optionalShortText,
    scheduleId: z.string().optional().transform((v) => (v ? v : null)),
  })
  .refine(
    (data) => !data.role || !isSelfServiceRole(data.role) || data.employeeCode !== null,
    {
      message: "ID Karyawan wajib diisi untuk akun karyawan dan magang.",
      path: ["employeeCode"],
    },
  );

export const resetPasswordSchema = z.object({
  id: z.string().min(1),
  newPassword: password,
});

export const setActiveSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export const deleteEmployeeSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export const scheduleSchema = z
  .object({
    name: trimmedName,
    startTime: timeString,
    endTime: timeString,
    lateToleranceMinutes: z.coerce.number().int().min(0).max(240),
    breakMinutes: z.coerce.number().int().min(0).max(480),
    isActive: z.coerce.boolean().default(true),
    makeDefault: z.coerce.boolean().default(false),
  })
  .refine((data) => data.startTime !== data.endTime, {
    message: "Jam mulai dan jam selesai tidak boleh sama.",
    path: ["endTime"],
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Jam selesai harus setelah jam mulai.",
    path: ["endTime"],
  });

export type ScheduleInputValidated = z.infer<typeof scheduleSchema>;

export const deleteScheduleSchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Attendance actions
// ---------------------------------------------------------------------------

/**
 * Coordinates supplied by the browser.
 *
 * `null` is accepted and meaningful: it represents "the employee declined or
 * could not share location", which the server records rather than rejects
 * unless location validation is enforced.
 */
export const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  accuracy: z.number().nonnegative().max(100_000).nullable().optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = checkInSchema;

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const reportFilterSchema = z.object({
  from: dateKey,
  to: dateKey,
  search: z.string().trim().max(80).optional(),
  status: z.union([attendanceStatusEnum, z.literal("ALL")]).default("ALL"),
  department: optionalShortText,
  userId: z.string().optional(),
});

export type ReportFilterInput = z.infer<typeof reportFilterSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(20),
});

// ---------------------------------------------------------------------------
// Settings & locations
// ---------------------------------------------------------------------------

export const locationSchema = z.object({
  name: trimmedName,
  address: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(25).max(10_000),
  isActive: z.coerce.boolean().default(true),
});

export const deleteLocationSchema = z.object({
  id: z.string().min(1),
});

export const settingsSchema = z.object({
  organizationName: trimmedName,
  timezone: z
    .string()
    .trim()
    .refine(
      (value) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Zona waktu harus berupa nama IANA yang valid, misal Asia/Jakarta." },
    ),
  defaultScheduleId: z.string().optional().transform((v) => (v ? v : null)),
  requireLocationValidation: z.coerce.boolean().default(false),
});

export const auditFilterSchema = z.object({
  action: z.string().trim().max(60).optional(),
  search: z.string().trim().max(80).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flattens a Zod error into `{ field: firstMessage }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}