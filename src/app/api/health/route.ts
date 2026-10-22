import { NextResponse } from "next/server";
import { COLLECTIONS, SETTINGS_DOC_ID, firestore } from "@/lib/db";
import { getFirebaseConfigStatus } from "@/lib/firebase-config";

/**
 * Deployment diagnostics.
 *
 * Answers the one question that is otherwise invisible until something breaks:
 * *can this deployment reach Firestore at all?*
 *
 * A local `npm run dev` works because `.env` holds the service account. A Vercel
 * deployment only has the variables that were pasted into its dashboard, so a
 * missing `FIREBASE_*` variable makes every read fail with a generic error page
 * and nothing else. This endpoint turns that into a readable answer.
 *
 * It deliberately exposes no secrets: only variable *names*, the project id and
 * a yes/no for reachability.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HealthReport {
  ok: boolean;
  firebase: {
    configured: boolean;
    projectId: string | null;
    source: string | null;
    missing: string[];
    problem: string | null;
  };
  firestore: {
    reachable: boolean;
    error: string | null;
  };
}

export async function GET(): Promise<NextResponse> {
  const status = getFirebaseConfigStatus();

  const report: HealthReport = {
    ok: false,
    firebase: {
      configured: status.configured,
      projectId: status.projectId,
      source: status.source,
      missing: status.missing,
      problem: status.problem,
    },
    firestore: {
      reachable: false,
      error: null,
    },
  };

  if (status.configured) {
    try {
      // A single document read is enough to prove both the network path and
      // the credentials; counting documents would cost more for no extra
      // information.
      await firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID).get();
      report.firestore.reachable = true;
      report.ok = true;
    } catch (error) {
      // The raw message can contain project details, so it stays in the log.
      console.error("[health] firestore unreachable", error);
      report.firestore.error =
        error instanceof Error ? error.message : "Firestore tidak dapat diakses.";
    }
  }

  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
