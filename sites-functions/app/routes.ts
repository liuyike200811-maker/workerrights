import { requireUser as bundledRequireUser } from "./auth.mjs";
import { runCaseAnalysis } from "./core/analysis.ts";
import { ensureActionPlan } from "./core/action_plan.ts";
import { createDemoCase } from "./core/demo.ts";
import { derivedResult } from "./core/derived.ts";
import { errorBody, fail, httpError } from "./core/errors.ts";
import { EVIDENCE_CATALOG } from "./core/evidence.ts";
import { buildPlainText, toDocx, toPdf } from "./core/export.ts";
import { NEW_CASE_FACTS, buildCaseTitle, recordFactChange, requiredProgress } from "./core/facts.ts";
import { runFormAssistant } from "./core/form_assistant.ts";
import { runLegalResearch } from "./core/legal_research.ts";
import { QCA_PROVIDER, metaPayload } from "./core/meta.ts";
import { REGION_INDEX } from "./core/regions.ts";
import { LegalRetriever, sortedChannels } from "./core/retriever.ts";
import { serializeCase, serializeCaseBrief, serializeMessage } from "./core/serializers.ts";
import {
  appendMessage, findIntent, findIntentByFingerprint, getOwnedCase, insertCase, insertIntent,
  listCases, newCaseRow, saveCase, type Db, type QcaIntent,
} from "./core/store.ts";
import type { CaseRow } from "./core/types.ts";
import { canonicalJson, deepClone, isUuid, newId, nowIso, sha256Hex } from "./core/util.ts";
import { REGIONS } from "./knowledge/data.ts";
import { createCoordinator, type Coordinator } from "./qca/coordinator.ts";
import { ensureBindings, type QcaBindings, type QcaClient } from "./qca/resources.ts";
import { encodeSSE } from "./qca/sse.mjs";
import { driveTurn, type TurnDeps } from "./qca/turn.ts";

export interface QcaService {
  client: QcaClient;
  coordinator: Coordinator;
  ensureBindings: () => Promise<QcaBindings>;
}

export interface AppDeps {
  db: Db;
  requireUser?: (context: { request: Request }) => { user_id: string };
  qca: QcaService | null;
  retriever?: LegalRetriever;
  applicationScope?: string;
}

interface Context {
  request: Request;
  requestId?: string;
}

const EDITABLE_FACTS = new Set(Object.keys(NEW_CASE_FACTS).filter((key) => key !== "scene"));
const NUMERIC_FACTS = new Set([
  "daily_wage", "monthly_wage", "unit_price", "agreed_amount", "paid_amount", "owed_amount", "duration_months",
]);
const BOOLEAN_FACTS = new Set(["owed_amount_approx", "outside_scope"]);
const EVIDENCE_KEYS = new Set(EVIDENCE_CATALOG.map((item) => item.key));
const FACT_QUESTION_MAP: Record<string, string> = {
  location_city: "location", location_district: "district", work_type: "work_type",
  duration_text: "period", work_start: "period", work_end: "period",
  recruiter_type: "recruiter", manager_role: "manager", wage_basis: "wage_basis",
  owed_amount: "owed_amount", agreed_amount: "amounts", paid_amount: "amounts",
  has_contract: "contract", evidence: "evidence", project_name: "project_info",
  contractor_name: "project_info", prior_report: "prior_report",
};

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function errorResponse(error: unknown): Response {
  const code = (error as any)?.code;
  if (code === "login_required") return json({ detail: "请先登录后使用。" }, 401);
  if (code === "invalid_user_context") return json({ detail: "用户上下文无效。" }, 403);
  const { status, body } = errorBody(error);
  return json(body, status);
}

function businessPath(request: Request): string {
  const raw = new URL(request.url).pathname;
  const match = /^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/.exec(raw);
  let path = match ? (match[1] ?? "/") : raw;
  if (path.startsWith("/api/py")) path = path.slice("/api/py".length) || "/";
  return path.replace(/\/+$/, "") || "/";
}

async function readJson(request: Request): Promise<any> {
  const text = await request.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    httpError(400, "请求体不是有效的 JSON。");
  }
}

function ownerId(deps: AppDeps, context: Context): string {
  const requireUser = deps.requireUser ?? ((ctx: Context) => bundledRequireUser(ctx.request));
  return requireUser(context).user_id;
}

function turnDeps(deps: AppDeps, bindings: QcaBindings, retriever: LegalRetriever): TurnDeps {
  if (!deps.qca) fail("qca_not_configured", 503, "云端咨询尚未配置，请稍后重试。");
  return { db: deps.db, client: deps.qca.client, coordinator: deps.qca.coordinator, bindings, retriever };
}

async function resolveIntent(
  db: Db,
  caseRow: CaseRow,
  content: string,
  clientKey: string | null,
): Promise<{ intent?: QcaIntent; done?: Record<string, unknown> }> {
  const fingerprint = (await sha256Hex(canonicalJson([caseRow.id, content, caseRow.facts_revision, caseRow.message_seq]))).slice(0, 32);
  let intent = clientKey ? await findIntent(db, caseRow.id, clientKey) : null;
  if (!intent) {
    const prior = await findIntentByFingerprint(db, caseRow.id, fingerprint);
    if (prior && prior.state !== "failed") intent = prior;
  }
  if (intent && intent.state === "done") return { done: intent.result ?? undefined };
  if (!intent) {
    const key = clientKey ?? newId();
    const now = nowIso();
    const candidate: QcaIntent = {
      id: newId(), case_id: caseRow.id, owner_id: caseRow.owner_id, idempotency_key: key,
      fingerprint, state: "pending", session_id: null, prompt_event_id: null, last_event_id: null,
      result: null, error: null, created_at: now, updated_at: now,
    };
    const inserted = await insertIntent(db, candidate);
    intent = inserted ? candidate : await findIntent(db, caseRow.id, key);
    if (!intent) fail("write_conflict", 409, "本轮状态已变化，请重试。");
  }
  return { intent: intent! };
}

function clientKeyOf(payload: any): string | null {
  const key = payload?.idempotency_key;
  if (key === undefined || key === null || key === "") return null;
  if (typeof key !== "string" || !isUuid(key)) httpError(400, "idempotency_key 必须是 UUID。");
  return key;
}

function preliminaryOverlay(payload: Record<string, unknown>, caseRow: CaseRow, note: string): Record<string, unknown> {
  const preliminary = !Boolean((caseRow.intake ?? {}).confirmed);
  payload.preliminary = preliminary;
  if (preliminary) payload.preliminary_note = note;
  return payload;
}

export function application(deps: AppDeps) {
  const retriever = deps.retriever ?? new LegalRetriever();
  const coordinator = deps.qca?.coordinator ?? createCoordinator(deps.db);

  async function handle(context: Context): Promise<Response> {
    const request = context.request;
    const path = businessPath(request);
    const method = request.method.toUpperCase();

    if (path === "/health" && method === "GET") {
      return json({ status: "ok", service: "WorkerRights API", provider: QCA_PROVIDER, time: nowIso() });
    }
    if (path === "/meta" && method === "GET") return json(metaPayload());
    if (path === "/regions/henan" && method === "GET") {
      return json({
        province: REGIONS.province,
        cities: REGIONS.cities.map((city: any) => ({
          name: city.name,
          code: city.code,
          districts: city.districts.map((district: any) => (typeof district === "string" ? district : district[0])),
        })),
        note: "行政区划精确到县区；具体维权受理机构需按管辖规则核实，并非每个区县都有独立机构。",
      });
    }
    if (path === "/channels" && method === "GET") {
      return json({ channels: sortedChannels(), note: "渠道入口和管辖规则以官方最新公布为准。" });
    }
    if (path === "/legal/documents" && method === "GET") {
      return json({
        documents: retriever.allDocuments(),
        note: "verification_status: verified=已核验；transcribed=按公开发布文本整理待逐条核验；pending=待核验。",
      });
    }
    if (path === "/legal/search" && method === "GET") {
      const url = new URL(request.url);
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q || q.length > 300) httpError(422, "检索词长度需在 1 到 300 之间。");
      const topK = Math.min(20, Math.max(1, Number(url.searchParams.get("top_k") ?? 8) || 8));
      const region = url.searchParams.get("region");
      if (region !== null && region !== "henan" && region !== "national") httpError(422, "region 仅支持 henan 或 national。");
      return json({ query: q, results: retriever.search(q, topK, 0.35, null, region), disclaimer: "检索结果来自本地知识库；地方条文以工地所在地为准，请以官方原文为准。" });
    }

    const owner = ownerId(deps, context);

    if (path === "/cases" && method === "GET") {
      const cases = await listCases(deps.db, owner);
      return json({ cases: cases.map(serializeCaseBrief) });
    }
    if (path === "/cases" && method === "POST") {
      const payload = await readJson(request);
      const scene = payload?.scene ?? "construction_wage_arrears";
      if (scene !== "construction_wage_arrears") httpError(400, "首期仅完整支持建筑工地欠薪场景。");
      const caseRow = newCaseRow(owner, scene, NEW_CASE_FACTS);
      caseRow.intake = { confirmed: false, unknowns: {}, skipped: [], agent_stage: "waiting_user" };
      appendMessage(caseRow, "assistant", "你好，工资没结清的话，可以跟我说说。我帮你把账和下一步理清楚。", {
        kind: "question", provider: QCA_PROVIDER.display_name, provider_is_mock: false,
      });
      await insertCase(deps.db, caseRow);
      return json({ case: serializeCase(caseRow), provider: QCA_PROVIDER }, 201);
    }
    if (path === "/cases/demo" && method === "POST") {
      const caseRow = await createDemoCase(deps.db, owner, retriever);
      return json({ case: serializeCase(caseRow), is_demo: true }, 201);
    }

    const caseMatch = /^\/cases\/([^/]+)(\/.*)?$/.exec(path);
    if (!caseMatch) httpError(404, "接口不存在。");
    const caseId = caseMatch![1];
    const sub = caseMatch![2] ?? "";
    const caseRow = await getOwnedCase(deps.db, caseId, owner);

    if (sub === "" && method === "GET") return json({ case: serializeCase(caseRow) });
    if (sub === "" && method === "DELETE") {
      return coordinator.withLock(`case:${caseId}`, async () => {
        const current = await getOwnedCase(deps.db, caseId, owner);
        current.deleted = true;
        await saveCase(deps.db, current, current.row_version);
        return json({ deleted: true, case_id: caseId });
      });
    }

    if (sub === "/messages" && method === "POST") {
      const payload = await readJson(request);
      const content = String(payload?.content ?? "").trim();
      if (!content) httpError(422, "消息不能为空。");
      const key = clientKeyOf(payload);
      if (!deps.qca) fail("qca_not_configured", 503, "云端咨询尚未配置，请稍后重试。");
      const resolved = await resolveIntent(deps.db, caseRow, content, key);
      if (resolved.done) return json(resolved.done);
      const bindings = await deps.qca.ensureBindings();
      const td = turnDeps(deps, bindings, retriever);
      const deadline = Date.now() + 50_000;
      const outcome = await driveTurn(td, resolved.intent!.id, content, () => {}, deadline);
      if (outcome.status === "done") return json(outcome.result);
      fail("qca_initialization_pending", 503, "本轮处理时间较长，请进入案件页继续查看回复。");
    }

    if (sub === "/messages/stream" && method === "POST") {
      const payload = await readJson(request);
      const content = String(payload?.content ?? "").trim();
      if (!content) httpError(422, "消息不能为空。");
      const key = clientKeyOf(payload);
      if (!deps.qca) fail("qca_not_configured", 503, "云端咨询尚未配置，请稍后重试。");
      return streamTurn(deps, caseRow, content, key, retriever);
    }

    if (sub === "/facts" && method === "PATCH") {
      const payload = await readJson(request);
      return coordinator.withLock(`case:${caseId}`, async () => {
        const current = await getOwnedCase(deps.db, caseId, owner);
        return json(await updateFacts(deps.db, current, payload?.facts ?? {}));
      });
    }

    if (sub === "/legal-basis" && method === "GET") {
      return json(runLegalResearch(caseRow, retriever));
    }
    if (sub === "/analysis" && method === "GET") {
      const analysis = await derivedResult(deps.db, caseRow, "analysis", () => runCaseAnalysis(caseRow, retriever));
      return json(preliminaryOverlay(analysis, caseRow, "案件信息尚未确认，以下分析会随后续补充和修改更新。"));
    }
    if (sub === "/action-plan" && method === "GET") {
      const plan = await derivedResult(deps.db, caseRow, "action_plan", () => ensureActionPlan(caseRow, retriever));
      preliminaryOverlay(plan, caseRow, "案件信息尚未确认，行动指南为初步版本，请先补充并核对信息。");
      plan.case_status = caseRow.status;
      return json(plan);
    }
    if (sub === "/form-assistant" && method === "GET") {
      const form = await derivedResult(deps.db, caseRow, "form_assistant", () => runFormAssistant(caseRow));
      return json(preliminaryOverlay(form, caseRow, "案件信息尚未确认，部分字段会显示为待补充或待核实。"));
    }

    const stepMatch = /^\/action-plan\/steps\/([^/]+)$/.exec(sub);
    if (stepMatch && method === "PATCH") {
      const payload = await readJson(request);
      return coordinator.withLock(`case:${caseId}`, async () => {
        const current = await getOwnedCase(deps.db, caseId, owner);
        return json(await updateStep(deps.db, current, stepMatch![1], Boolean(payload?.done), retriever));
      });
    }

    const exportMatch = /^\/export\/(docx|pdf|txt)$/.exec(sub);
    if (exportMatch && method === "GET") {
      return exportCase(deps.db, caseRow, exportMatch![1] as "docx" | "pdf" | "txt", retriever);
    }

    httpError(404, "接口不存在。");
  }

  return async (context: Context): Promise<Response> => {
    try {
      return await handle(context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

function streamTurn(deps: AppDeps, caseRow: CaseRow, content: string, key: string | null, retriever: LegalRetriever): Response {
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encodeSSE(event, data));
      };
      const emit = (obj: Record<string, unknown>) => send(String(obj.type ?? "message"), obj);
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(new TextEncoder().encode(": hb\n\n"));
      }, 15_000);
      try {
        const resolved = await resolveIntent(deps.db, caseRow, content, key);
        if (resolved.done) {
          const result = resolved.done;
          const assistant = (result.assistant_message ?? {}) as Record<string, unknown>;
          const meta = (assistant.meta ?? {}) as Record<string, unknown>;
          emit({ type: "reply_snapshot", text: assistant.content ?? "", citations: meta.citations ?? [] });
          emit({ type: "done", result });
          return;
        }
        const bindings = await deps.qca!.ensureBindings();
        const td = turnDeps(deps, bindings, retriever);
        const outcome = await driveTurn(td, resolved.intent!.id, content, emit, Date.now() + 90_000);
        if (outcome.status === "pending") emit({ type: "pending" });
      } catch (error) {
        const { body } = errorBody(error);
        console.error(JSON.stringify({
          event: "sites_turn_failed",
          name: (error as any)?.name ?? null,
          code: (error as any)?.code ?? null,
          message: (error as any)?.message ?? String(error),
        }));
        emit({ type: "error", message: (body as any).detail ?? "本轮处理失败，请重试。", code: (body as any).error ?? null });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

async function updateFacts(db: Db, caseRow: CaseRow, updates: Record<string, unknown>): Promise<Record<string, unknown>> {
  const unknownKeys = Object.keys(updates).filter((key) => !EDITABLE_FACTS.has(key));
  if (unknownKeys.length) httpError(400, `不允许修改的字段：${unknownKeys.sort().join(", ")}`);

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (NUMERIC_FACTS.has(key)) {
      if (value === null || value === "") normalized[key] = null;
      else {
        const number = Number(value);
        if (!Number.isFinite(number)) httpError(400, `${key} 必须是数字。`);
        normalized[key] = number;
      }
    } else if (BOOLEAN_FACTS.has(key)) {
      normalized[key] = Boolean(value);
    } else if (key === "evidence") {
      if (value === null) normalized[key] = [];
      else if (Array.isArray(value)) {
        const invalid = value.filter((item) => !EVIDENCE_KEYS.has(item));
        if (invalid.length) httpError(400, `未知证据类型：${JSON.stringify(invalid)}`);
        normalized[key] = value;
      } else httpError(400, "evidence 必须是数组。");
    } else if (key === "has_contract") {
      if (![null, "", "yes", "no", "unknown"].includes(value as any)) httpError(400, "has_contract 取值无效。");
      normalized[key] = value || null;
    } else if (key === "prior_report") {
      if (![null, "", "yes", "no"].includes(value as any)) httpError(400, "prior_report 取值无效。");
      normalized[key] = value || null;
    } else if (typeof value === "string") {
      normalized[key] = value.trim() || null;
    } else {
      normalized[key] = value;
    }
  }

  const before = deepClone(caseRow.facts);
  caseRow.facts = { ...caseRow.facts, ...normalized };
  if (caseRow.facts.location_city) {
    const city = REGION_INDEX[caseRow.facts.location_city];
    if (city) {
      caseRow.facts.location_province = "河南省";
      const district = caseRow.facts.location_district;
      if (district && !(district in city.districts)) caseRow.facts.location_district = null;
    }
  }
  caseRow.title = buildCaseTitle(caseRow.facts);

  const intake = { ...(caseRow.intake ?? {}) };
  const unknowns = { ...((intake.unknowns as Record<string, unknown>) ?? {}) };
  for (const key of Object.keys(normalized)) {
    const questionKey = FACT_QUESTION_MAP[key];
    if (questionKey) delete unknowns[questionKey];
  }
  intake.unknowns = unknowns;
  caseRow.intake = intake;

  const changed = recordFactChange(caseRow, before);
  if (changed) {
    caseRow.intake = { ...caseRow.intake, confirmed: false, agent_stage: "waiting_user" };
    caseRow.status = "collecting";
    caseRow.plan_generated_at = null;
  }

  const message = appendMessage(caseRow, "assistant", "案件信息已更新，我会根据新的信息重新整理分析和行动指南。", {
    kind: "facts_updated",
    question: null,
    quick_replies: [],
    updated_keys: Object.keys(normalized),
    demo: caseRow.is_demo,
  });
  const saved = await saveCase(db, caseRow, caseRow.row_version);
  return {
    case: serializeCase(saved),
    message: serializeMessage(message),
    next_question: null,
    progress: requiredProgress(saved.facts, saved.intake ?? {}),
  };
}

async function updateStep(db: Db, caseRow: CaseRow, stepId: string, done: boolean, retriever: LegalRetriever): Promise<Record<string, unknown>> {
  const plan = await derivedResult(db, caseRow, "action_plan", () => ensureActionPlan(caseRow, retriever));
  if (plan.generated_from_revision !== caseRow.facts_revision) {
    httpError(409, "信息已更新，请重新生成。请返回对话重新核对并确认案件信息后，再勾选行动步骤。");
  }
  const steps = (plan.steps ?? []) as Array<Record<string, unknown>>;
  const step = steps.find((item) => item.id === stepId);
  if (!step) httpError(404, "步骤不存在。");
  step!.done = done;
  step!.done_at = done ? nowIso() : null;
  const doneCount = steps.filter((item) => item.done).length;
  const total = steps.length;
  plan.progress = { done: doneCount, total, percent: total ? Math.round((doneCount / total) * 100) : 0 };
  caseRow.derived_results = { ...caseRow.derived_results, action_plan: deepClone(plan) };
  const saved = await saveCase(db, caseRow, caseRow.row_version);
  plan.preliminary = !Boolean((saved.intake ?? {}).confirmed);
  if (plan.preliminary) plan.preliminary_note = "案件信息尚未确认，行动指南为初步版本，请先补充并核对信息。";
  plan.case_status = saved.status;
  return plan;
}

async function exportCase(db: Db, caseRow: CaseRow, fmt: "docx" | "pdf" | "txt", retriever: LegalRetriever): Promise<Response> {
  const stale = Object.values(caseRow.derived_results ?? {}).some(
    (result: any) => result?.generated_from_revision !== caseRow.facts_revision,
  );
  if (stale) httpError(409, "信息已更新，请重新生成。请返回对话重新核对并确认案件信息后，再导出材料。");
  const analysis = await derivedResult(db, caseRow, "analysis", () => runCaseAnalysis(caseRow, retriever));
  const plan = await derivedResult(db, caseRow, "action_plan", () => ensureActionPlan(caseRow, retriever));
  let content: Uint8Array;
  let mediaType: string;
  if (fmt === "docx") {
    content = toDocx(caseRow, analysis, plan);
    mediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (fmt === "pdf") {
    content = toPdf(caseRow, analysis, plan);
    mediaType = "application/pdf";
  } else {
    content = new TextEncoder().encode(buildPlainText(caseRow, analysis, plan));
    mediaType = "text/plain; charset=utf-8";
  }
  const filename = `workerrights-case-${caseRow.id}.${fmt}`;
  return new Response(content, {
    headers: { "content-type": mediaType, "content-disposition": `attachment; filename="${filename}"` },
  });
}