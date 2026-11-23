import assert from "node:assert/strict";
import test from "node:test";
import { application } from "../app/routes.ts";
import { createCoordinator } from "../app/qca/coordinator.ts";
import { LegalRetriever, sortedChannels } from "../app/core/retriever.ts";
import { runLegalResearch } from "../app/core/legal_research.ts";
import { caseRegionScope, mentionsHenan } from "../app/core/regions.ts";
import { KNOWLEDGE_VERSION } from "../app/knowledge/data.ts";
import { createFakeDb } from "./fake-db.mjs";
import { createFakeQca } from "./fake-qca.mjs";

const retriever = new LegalRetriever();
const isHenan = (item) => item.id.startsWith("hnlsr-") || item.id.startsWith("hnbzj-") || item.id.startsWith("hnzh-") || item.document.region === "henan";

function makeCase(facts) {
  return { id: "case-test", title: "测试", status: "collecting", is_demo: false, facts, intake: {} };
}

test("region scope follows the worksite location", () => {
  assert.equal(caseRegionScope({ location_province: "河南省", location_city: "郑州市" }), "henan");
  assert.equal(caseRegionScope({ location_city: "洛阳" }), "henan");
  assert.equal(caseRegionScope({ location_province: "广东省", location_city: "深圳市" }), "national");
  assert.equal(caseRegionScope({ location_city: "深圳市" }), "national");
  assert.equal(caseRegionScope({}), null);
  assert.equal(mentionsHenan("河南 工资保证金"), true);
  assert.equal(mentionsHenan("郑州 专用账户"), true);
  assert.equal(mentionsHenan("深圳 工地 欠薪"), false);
});

test("henan scope surfaces local provisions with applicability conditions", () => {
  const results = retriever.search("河南 郑州 工资保证金 动用 支付", 8, 0.35, null, "henan");
  assert.ok(results.some((item) => item.id === "hnbzj-26"));
  for (const item of results.filter(isHenan)) {
    assert.ok(item.conditions[0].includes("河南"), `${item.id} missing geo condition`);
    assert.equal(item.verification_status, "verified");
  }
  const supervision = retriever.search("河南 投诉 立案 七日 结案 时限", 8, 0.35, null, "henan");
  assert.ok(supervision.some((item) => item.id === "hnlsr-15" || item.id === "hnlsr-16"));
});

test("national scope and unknown location exclude Henan provisions", () => {
  const scoped = retriever.search("工资保证金 专用账户 拖欠工资", 12, 0.2, null, "national");
  assert.ok(scoped.length > 0);
  assert.ok(scoped.every((item) => !isHenan(item)));
  const auto = retriever.search("工资保证金 专用账户 拖欠工资", 12, 0.2);
  assert.ok(auto.every((item) => !isHenan(item)));
  const hinted = retriever.search("河南 工资保证金 动用", 8, 0.35);
  assert.ok(hinted.some(isHenan));
});

test("legal research: Henan case gets local core, other provinces do not", () => {
  const henan = runLegalResearch(makeCase({ location_province: "河南省", location_city: "郑州市", recruiter_type: "包工头", has_contract: "no" }), retriever);
  const henanIds = henan.provisions.map((item) => item.id);
  for (const id of ["hnlsr-15", "hnlsr-16", "hnlsr-21", "hnzh-16", "hnzh-13", "hnbzj-26"]) {
    assert.ok(henanIds.includes(id), `missing ${id}`);
  }
  assert.ok(henan.query.includes("河南"));
  assert.ok(henan.provisions.every((item) => item.verification_label));

  const other = runLegalResearch(makeCase({ location_province: "广东省", location_city: "深圳市", recruiter_type: "包工头" }), retriever);
  assert.ok(other.provisions.every((item) => !isHenan(item)));
  assert.ok(!other.query.includes("河南"));

  const unknown = runLegalResearch(makeCase({ recruiter_type: "包工头" }), retriever);
  assert.ok(unknown.provisions.every((item) => !isHenan(item)));
});

test("corrected mwpr-16 and new national provisions are consistent", () => {
  const [mwpr16] = retriever.getMany(["mwpr-16"]);
  assert.equal(mwpr16.article, "第十六条");
  assert.ok(mwpr16.text.includes("应当依法予以清偿"));
  const [mwpr12] = retriever.getMany(["mwpr-12"]);
  assert.ok(mwpr12.text.includes("足额支付工资"));
  const henan20 = retriever.getMany(["hnlsr-20"])[0];
  assert.ok(henan20.text.includes("二倍的工资"));
});

test("channels: verified housing entry, no duplicate ids", () => {
  const channels = sortedChannels();
  const ids = channels.map((channel) => channel.id);
  assert.equal(new Set(ids).size, ids.length);
  const housing = channels.find((channel) => channel.id === "henan-housing-authority");
  assert.equal(housing.verification_status, "verified");
  assert.ok(housing.official_url.includes("hngcjs.hnjs.henan.gov.cn"));
  const supervision = channels.find((channel) => channel.id === "local-labor-supervision");
  assert.ok(supervision.source_note.includes("404"));
});

const owner = "owner-knowledge";
const bindings = {
  consult: { agent: { type: "agent", id: "agent_consult", version: 1 }, environment_id: "env_x" },
  classify: { agent: { type: "agent", id: "agent_classify", version: 1 }, environment_id: "env_x" },
  review: { agent: { type: "agent", id: "agent_review", version: 1 }, environment_id: "env_x" },
  model: "model-a",
};

function makeApp(qcaOptions = {}) {
  const db = createFakeDb();
  const client = createFakeQca({ classifyRoute: "case", ...qcaOptions });
  const coordinator = createCoordinator(db, 60_000);
  const app = application({
    db,
    requireUser: () => ({ user_id: owner }),
    qca: { client, coordinator, ensureBindings: async () => bindings },
    retriever,
  });
  return { app, db };
}

function request(method, path, body) {
  return new Request(`https://site.test/api/py${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(app, method, path, body) {
  const response = await app({ request: request(method, path, body) });
  return { status: response.status, json: await response.json() };
}

test("QCA search_law respects case region and citations stay consistent", async () => {
  const { app } = makeApp({
    recordFactsArgs: { patch: { location_province: "广东省", location_city: "深圳市" }, source_quote: "我在深圳工地干活" },
    searchLawQuery: "工资保证金 专用账户 拖欠工资",
    respondArgs: { reply: "我记下了：深圳的工地欠薪。", response_kind: "chat", next_question: null, stage: "waiting_user", citation_ids: [] },
  });
  const created = await call(app, "POST", "/cases", {});
  const caseId = created.json.case.id;
  const sent = await call(app, "POST", `/cases/${caseId}/messages`, { content: "我在深圳工地干活，工资没结清。" });
  assert.equal(sent.status, 200);
  const trace = sent.json.assistant_message.meta.agent_trace;
  const searchStep = trace.find((step) => step.action === "search_law");
  assert.ok(searchStep && searchStep.ok);
  const citations = sent.json.assistant_message.meta.citations;
  assert.ok(citations.every((item) => !isHenan(item)));

  const legal = await call(app, "GET", `/cases/${caseId}/legal-basis`);
  assert.ok(legal.json.provisions.every((item) => !isHenan(item)));
});

test("QCA search_law for a Henan case can cite local provisions", async () => {
  const { app } = makeApp({
    recordFactsArgs: { patch: { location_province: "河南省", location_city: "郑州市" }, source_quote: "我在郑州工地干活" },
    searchLawQuery: "河南 郑州 工资保证金 动用 支付通知书",
    respondArgs: { reply: "郑州的工地欠薪，保证金条例可以看看[hnbzj-26]。", response_kind: "chat", next_question: null, stage: "waiting_user", citation_ids: ["hnbzj-26"] },
  });
  const created = await call(app, "POST", "/cases", {});
  const caseId = created.json.case.id;
  const sent = await call(app, "POST", `/cases/${caseId}/messages`, { content: "我在郑州工地干活，工资没结清。" });
  assert.equal(sent.status, 200);
  const citations = sent.json.assistant_message.meta.citations;
  const cited = citations.find((item) => item.id === "hnbzj-26");
  assert.ok(cited, "hnbzj-26 should be citable");
  assert.equal(cited.verification_status, "verified");
  const legal = await call(app, "GET", `/cases/${caseId}/legal-basis`);
  const inAnalysis = legal.json.provisions.find((item) => item.id === "hnbzj-26");
  assert.ok(inAnalysis);
  assert.equal(inAnalysis.text, cited.text);
  assert.equal(inAnalysis.document.official_url, cited.document.official_url);
});

test("knowledge upgrade regenerates cached analysis and plan, keeping step marks", async () => {
  const { app, db } = makeApp();
  const created = await call(app, "POST", "/cases", {});
  const caseId = created.json.case.id;
  await call(app, "PATCH", `/cases/${caseId}/facts`, { facts: { location_city: "郑州市", owed_amount: 20000 } });

  const first = await call(app, "GET", `/cases/${caseId}/analysis`);
  assert.equal(first.json.knowledge_version, KNOWLEDGE_VERSION);
  const plan = await call(app, "GET", `/cases/${caseId}/action-plan`);
  const stepId = plan.json.steps[0].id;
  await call(app, "PATCH", `/cases/${caseId}/action-plan/steps/${stepId}`, { done: true });

  // Simulate a pre-upgrade cache: no knowledge_version stamp.
  const row = db._tables.get("cases").find((item) => item.id === caseId);
  delete row.derived_results.analysis.knowledge_version;
  delete row.derived_results.action_plan.knowledge_version;
  const oldGeneratedAt = row.derived_results.analysis.generated_at;

  const refreshed = await call(app, "GET", `/cases/${caseId}/analysis`);
  assert.equal(refreshed.json.knowledge_version, KNOWLEDGE_VERSION);
  assert.notEqual(refreshed.json.generated_at, oldGeneratedAt);
  const refreshedPlan = await call(app, "GET", `/cases/${caseId}/action-plan`);
  assert.equal(refreshedPlan.json.knowledge_version, KNOWLEDGE_VERSION);
  assert.equal(refreshedPlan.json.steps[0].done, true);
  assert.equal(refreshedPlan.json.progress.done, 1);
});

test("legal search endpoint validates region parameter", async () => {
  const { app } = makeApp();
  const bad = await call(app, "GET", "/legal/search?q=欠薪&region=guangdong");
  assert.equal(bad.status, 422);
  const national = await call(app, "GET", "/legal/search?q=工资保证金+专用账户&region=national");
  assert.ok(national.json.results.every((item) => !isHenan(item)));
  const henan = await call(app, "GET", "/legal/search?q=工资保证金+动用&region=henan");
  assert.ok(henan.json.results.some(isHenan));
});

test("meta exposes the knowledge version", async () => {
  const { app } = makeApp();
  const meta = await call(app, "GET", "/meta");
  assert.equal(meta.json.knowledge_version, KNOWLEDGE_VERSION);
});