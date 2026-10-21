import { firestore } from "../src/lib/firebase-config";

/** Deletes every document in a collection, in batches of 400. */
export async function deleteCollection(name: string): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snapshot = await firestore.collection(name).limit(400).get();
    if (snapshot.empty) break;
    const batch = firestore.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snapshot.size;
  }
  return deleted;
}

export async function deleteCollections(names: readonly string[]): Promise<void> {
  for (const name of names) {
    const deleted = await deleteCollection(name);
    if (deleted > 0) console.log(`  ${name}: ${deleted} document(s) deleted`);
  }
}
