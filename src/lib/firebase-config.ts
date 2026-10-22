import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Shared Firebase Admin bootstrap.
 *
 * This module deliberately has no `server-only` import so the operational
 * scripts (`npm run db:seed`, `bootstrap:admin`, the PostgreSQL importer) can
 * reuse exactly the same credential handling as the application. It must never
 * be imported from a Client Component; `src/lib/db.ts` is the guarded entry
 * point used by the app.
 *
 * Initialization is lazy. `next build` imports route modules to collect their
 * configuration, and a build machine is not guaranteed to have the service
 * account. Creating the client on first use keeps `next build` working while
 * still failing loudly at request time if the deployment is misconfigured.
 */

/**
 * Raised when the deployment is missing the credentials needed to reach
 * Firestore.
 *
 * This is a *deployment* problem, not a user problem, so it gets its own type:
 * the login flow can then show "the server is not configured" instead of the
 * generic "something went wrong" page, which is the difference between a
 * five-minute fix and an hour of guesswork.
 */
export class FirebaseConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[], message?: string) {
    super(
      message ??
        `Firebase is not configured. Missing environment variable(s): ${missing.join(", ")}. ` +
          "See .env.example.",
    );
    this.name = "FirebaseConfigurationError";
    this.missing = missing;
  }
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function parseServiceAccount(raw: string): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  // Vercel environment variables often carry the JSON key as a single line.
  // Accepting base64 as well avoids the escaping problems that come with
  // newlines inside a multi-line value.
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  let parsed: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new FirebaseConfigurationError(
      ["FIREBASE_SERVICE_ACCOUNT_JSON"],
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON (or valid base64 of JSON). " +
        "Copy the whole service-account JSON as a single line.",
    );
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new FirebaseConfigurationError(
      ["FIREBASE_SERVICE_ACCOUNT_JSON"],
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key.",
    );
  }
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: normalizePrivateKey(parsed.private_key),
  };
}

/**
 * How the Firebase Admin SDK is expected to authenticate, derived purely from
 * the environment.
 *
 * Used by `/api/health` so a misconfigured deployment can be diagnosed with a
 * single request instead of by reading server logs. It never returns secret
 * values — only names of variables and the project id.
 */
export interface FirebaseConfigStatus {
  /** True when the environment carries everything needed to reach Firestore. */
  configured: boolean;
  projectId: string | null;
  /** Which credential style the deployment uses. */
  source: "emulator" | "service-account-json" | "client-email" | "application-default" | null;
  /** Names of the variables that still have to be set (empty when configured). */
  missing: string[];
  /** Human readable reason when `configured` is false. */
  problem: string | null;
}

export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    (emulatorHost ? "demo-attendance" : undefined);

  if (emulatorHost) {
    return projectId
      ? { configured: true, projectId, source: "emulator", missing: [], problem: null }
      : {
          configured: false,
          projectId: null,
          source: null,
          missing: ["FIREBASE_PROJECT_ID"],
          problem: "FIREBASE_PROJECT_ID is required when using the Firestore emulator.",
        };
  }

  const serviceAccountRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountRaw) {
    try {
      const account = parseServiceAccount(serviceAccountRaw);
      return {
        configured: true,
        projectId: account.projectId,
        source: "service-account-json",
        missing: [],
        problem: null,
      };
    } catch (error) {
      return {
        configured: false,
        projectId: projectId ?? null,
        source: null,
        missing: ["FIREBASE_SERVICE_ACCOUNT_JSON"],
        problem: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      configured: true,
      projectId,
      source: "client-email",
      missing: [],
      problem: null,
    };
  }

  if (projectId) {
    // Application Default Credentials: GOOGLE_APPLICATION_CREDENTIALS or the
    // GCE metadata server. Only useful on machines/VMs that already have a
    // service account attached.
    return {
      configured: true,
      projectId,
      source: "application-default",
      missing: [],
      problem: null,
    };
  }

  const missing = ["FIREBASE_PROJECT_ID"];
  if (!clientEmail || !privateKey) {
    missing.push("FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_JSON)");
  }
  return {
    configured: false,
    projectId: null,
    source: null,
    missing,
    problem:
      "Firebase is not configured. Set FIREBASE_PROJECT_ID and either " +
      "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY. " +
      "See .env.example.",
  };
}

function createApp(): App {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    (emulatorHost ? "demo-attendance" : undefined);

  if (emulatorHost) {
    if (!projectId) {
      throw new FirebaseConfigurationError(
        ["FIREBASE_PROJECT_ID"],
        "FIREBASE_PROJECT_ID is required when using the Firestore emulator.",
      );
    }
    // The emulator accepts unauthenticated clients; no service account needed.
    return initializeApp({ projectId });
  }

  const serviceAccountRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountRaw) {
    const account = parseServiceAccount(serviceAccountRaw);
    return initializeApp({
      credential: cert({
        projectId: account.projectId,
        clientEmail: account.clientEmail,
        privateKey: account.privateKey,
      }),
      projectId: account.projectId,
    });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: normalizePrivateKey(privateKey),
      }),
      projectId,
    });
  }

  if (projectId) {
    // Supports GOOGLE_APPLICATION_CREDENTIALS or the metadata server. This is
    // mainly useful for local development with `gcloud auth application-default login`.
    return initializeApp({ credential: applicationDefault(), projectId });
  }

  throw new FirebaseConfigurationError([
    "FIREBASE_PROJECT_ID",
    "FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)",
  ]);
}

let cached: Firestore | null = null;

function instance(): Firestore {
  if (cached) return cached;

  const app = getApps()[0] ?? createApp();
  const db = getFirestore(app);

  // `undefined` is not a valid Firestore value. Optional form fields are often
  // absent rather than null, so let the SDK ignore them instead of making every
  // caller remember to strip them.
  const globalForFirestore = globalThis as unknown as {
    __firestoreConfigured?: boolean;
  };
  if (!globalForFirestore.__firestoreConfigured) {
    db.settings({ ignoreUndefinedProperties: true });
    globalForFirestore.__firestoreConfigured = true;
  }

  cached = db;
  return db;
}

/**
 * Lazy Firestore client. Property access is forwarded to the real client, and
 * methods are bound so `firestore.collection(...)` keeps its receiver.
 */
export const firestore: Firestore = new Proxy({} as Firestore, {
  get(_target, property) {
    const db = instance();
    const value = Reflect.get(db, property, db) as unknown;
    return typeof value === "function" ? value.bind(db) : value;
  },
  set(_target, property, value) {
    return Reflect.set(instance(), property, value);
  },
});

export function getFirebaseApp(): App {
  return getApps()[0] ?? createApp();
}
