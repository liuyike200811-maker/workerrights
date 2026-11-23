import { KNOWLEDGE_VERSION } from "../knowledge/data.ts";
import { saveCase, type Db } from "./store.ts";
import type { CaseRow } from "./types.ts";
import { deepClone } from "./util.ts";

// Mirrors AgentOrchestrator._derived_result: cache keyed by facts_revision.
// GET retains stale snapshots; response overlays must not enter the cache.
// A knowledge-base upgrade also invalidates the cache so unchanged cases pick
// up new provisions on the next read (action plan keeps step done marks).
export async function derivedResult(
  db: Db,
  caseRow: CaseRow,
  key: string,
  generate: () => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const cache = caseRow.derived_results ?? {};
  const cached = cache[key] as Record<string, unknown> | undefined;
  if (!cached || cached.knowledge_version !== KNOWLEDGE_VERSION) {
    const result = deepClone(generate());
    result.generated_from_revision = caseRow.facts_revision;
    result.knowledge_version = KNOWLEDGE_VERSION;
    caseRow.derived_results = { ...cache, [key]: result };
    const saved = await saveCase(db, caseRow, caseRow.row_version);
    caseRow.row_version = saved.row_version;
    caseRow.updated_at = saved.updated_at;
  }
  return deepClone(caseRow.derived_results[key]);
}