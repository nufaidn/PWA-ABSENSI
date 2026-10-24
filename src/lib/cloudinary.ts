import "server-only";
import { createHash } from "node:crypto";

/**
 * Cloudinary direct-upload support for doctor's notes.
 *
 * The browser uploads the file straight to Cloudinary using a short-lived
 * signature minted here. The file therefore never travels through a Server
 * Action (whose body limit is far below a phone photo) and the API secret never
 * leaves the server.
 *
 * Configuration:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *   CLOUDINARY_FOLDER (optional, defaults to "attendance/leave")
 */

const DEFAULT_FOLDER = "attendance/leave";

export class CloudinaryConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Cloudinary belum dikonfigurasi. Set ${missing.join(", ")} di environment server.`,
    );
    this.name = "CloudinaryConfigurationError";
    this.missing = missing;
  }
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = read("CLOUDINARY_CLOUD_NAME");
  const apiKey = read("CLOUDINARY_API_KEY");
  const apiSecret = read("CLOUDINARY_API_SECRET");

  const missing: string[] = [];
  if (!cloudName) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!apiKey) missing.push("CLOUDINARY_API_KEY");
  if (!apiSecret) missing.push("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryConfigurationError(missing);
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: read("CLOUDINARY_FOLDER") ?? DEFAULT_FOLDER,
  };
}

/** True when all three required variables are present. */
export function isCloudinaryConfigured(): boolean {
  try {
    getCloudinaryConfig();
    return true;
  } catch {
    return false;
  }
}

export interface LeaveUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
}

/**
 * Enforced by Cloudinary, not just by the file picker: the signature covers
 * `allowed_formats`, so a crafted direct upload cannot park an executable or a
 * multi-hundred-megabyte archive in the account.
 */
const ALLOWED_NOTE_FORMATS = "jpg,jpeg,png,webp,heic,heif,pdf";

/**
 * Builds the parameters signed for an upload.
 *
 * Cloudinary's rule: sort every signed parameter alphabetically, join them as
 * `key=value` with `&`, append the API secret, then SHA-1 the result. `file`,
 * `api_key`, `cloud_name` and `resource_type` are deliberately not signed.
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

export function createLeaveUploadSignature(
  userId: string,
  now: Date = new Date(),
): LeaveUploadSignature {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(now.getTime() / 1000);
  const baseFolder = config.folder.replace(/^\/+|\/+$/g, "");
  const folder = `${baseFolder}/${userId}`;
  const signature = signCloudinaryParams(
    { allowed_formats: ALLOWED_NOTE_FORMATS, folder, timestamp },
    config.apiSecret,
  );

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder,
    allowedFormats: ALLOWED_NOTE_FORMATS,
  };
}

/**
 * Rejects a submitted doctor-note URL unless it points at this Cloudinary
 * account and at the folder reserved for this employee.
 *
 * The URL travels through a hidden form field, so it is untrusted input: a
 * crafted value must not be able to make the admin view an arbitrary site.
 */
export function isLeaveDoctorNoteUrl(
  url: string,
  userId: string,
  config: CloudinaryConfig = getCloudinaryConfig(),
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") {
      return false;
    }
    if (!parsed.pathname.startsWith(`/${config.cloudName}/`)) return false;
    const folder = config.folder.replace(/^\/+|\/+$/g, "");
    return parsed.pathname.includes(`/${folder}/${userId}/`);
  } catch {
    return false;
  }
}
