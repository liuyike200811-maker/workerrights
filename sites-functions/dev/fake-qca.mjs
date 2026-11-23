// Deterministic QCA simulator for local turn-engine tests. Events are produced
// synchronously when the application POSTs, so history replay and the live
// stream both observe the scripted agent loop. Not a transport-fidelity test.
import { encodeSSE } from "../app/qca/sse.mjs";
import { CloudAgentsError } from "../app/qca/cloud-agents.mjs";

export function createFakeQca(options = {}) {
  const {
    classifyRoute = "case",
    classifyReason = "属于欠薪咨询",
    reviewAllowed = true,
    reviewReason = "回复在服务范围内",
    recordFactsArgs = { patch: { location_city: "郑州市", work_type: "钢筋工" } },
    searchLawQuery = null,
    respondArgs = { reply: "我记下了。", response_kind: "chat", next_question: null, stage: "waiting_user", citation_ids: [] },
    modelCredits = 0.5,
  } = options;

  const sessions = new Map();
  let seq = 0;
  const nextId = (prefix) => `${prefix}_${(++seq).toString(36).padStart(6, "0")}`;

  function emit(session, type, extra = {}) {
    const event = { id: nextId("evt"), type, processed_at: new Date().toISOString(), ...extra };
    session.events.push(event);
    return event;
  }

  function createSession(body) {
    const metadata = body?.metadata ?? {};
    const purpose = metadata.purpose ?? "consult";
    const kind = purpose === "scope_classify" ? "classify" : purpose === "scope_review" ? "review" : "consult";
    const session = {
      id: nextId("sess"), metadata, status: "idle", archived_at: null, events: [],
      kind, phase: "new", pendingCall: null,
    };
    sessions.set(session.id, session);
    return session;
  }

  function react(session, incoming) {
    const hasUserMessage = incoming.some((e) => e.type === "user.message");
    const toolResults = incoming.filter((e) => e.type === "user.custom_tool_result");
    if (session.kind === "classify" && hasUserMessage && session.phase === "new") {
      session.phase = "done";
      emit(session, "agent.custom_tool_use", { name: "classify_scope", input: { route: classifyRoute, reason: classifyReason } });
      emit(session, "session.usage", { model_credits: modelCredits, sandbox_runtime_credits: 0, total_credits: modelCredits });
      emit(session, "session.status_idle", { stop_reason: { type: "end_turn" } });
      session.status = "idle";
      return;
    }
    if (session.kind === "review" && hasUserMessage && session.phase === "new") {
      session.phase = "done";
      emit(session, "agent.custom_tool_use", { name: "review_scope", input: { allowed: reviewAllowed, reason: reviewReason } });
      emit(session, "session.usage", { model_credits: modelCredits, sandbox_runtime_credits: 0, total_credits: modelCredits });
      emit(session, "session.status_idle", { stop_reason: { type: "end_turn" } });
      session.status = "idle";
      return;
    }
    if (session.kind === "consult") {
      if (hasUserMessage && session.phase === "new") {
        session.phase = "await_record";
        session.status = "running";
        emit(session, "span.model_request_start", {});
        const call = emit(session, "agent.custom_tool_use", { name: "record_facts", input: recordFactsArgs });
        session.pendingCall = call.id;
        emit(session, "session.status_idle", { stop_reason: { type: "requires_action" } });
        return;
      }
      for (const result of toolResults) {
        if (session.phase === "await_record" && result.custom_tool_use_id === session.pendingCall) {
          if (searchLawQuery) {
            session.phase = "await_search";
            emit(session, "span.model_request_start", {});
            const call = emit(session, "agent.custom_tool_use", { name: "search_law", input: { query: searchLawQuery } });
            session.pendingCall = call.id;
            emit(session, "session.status_idle", { stop_reason: { type: "requires_action" } });
            continue;
          }
          session.phase = "await_respond";
          emit(session, "span.model_request_start", {});
          const call = emit(session, "agent.custom_tool_use", { name: "respond", input: respondArgs });
          session.pendingCall = call.id;
          emit(session, "session.usage", { model_credits: modelCredits, sandbox_runtime_credits: 0, total_credits: modelCredits });
          emit(session, "session.status_idle", { stop_reason: { type: "requires_action" } });
        } else if (session.phase === "await_search" && result.custom_tool_use_id === session.pendingCall) {
          session.phase = "await_respond";
          emit(session, "span.model_request_start", {});
          const call = emit(session, "agent.custom_tool_use", { name: "respond", input: respondArgs });
          session.pendingCall = call.id;
          emit(session, "session.usage", { model_credits: modelCredits, sandbox_runtime_credits: 0, total_credits: modelCredits });
          emit(session, "session.status_idle", { stop_reason: { type: "requires_action" } });
        } else if (session.phase === "await_respond" && result.custom_tool_use_id === session.pendingCall) {
          session.phase = "done";
          session.status = "idle";
          emit(session, "session.status_idle", { stop_reason: { type: "end_turn" } });
        }
      }
    }
  }

  function parseQuery(path) {
    const query = {};
    const index = path.indexOf("?");
    if (index >= 0) for (const pair of path.slice(index + 1).split("&")) {
      const [key, value] = pair.split("=");
      query[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
    }
    return query;
  }

  const client = {
    async request(path, opts = {}) {
      const method = (opts.method ?? "GET").toUpperCase();
      const clean = path.split("?")[0];
      const query = parseQuery(path);
      if (clean === "/api/v1/cloud/models" && method === "GET") {
        return { data: [{ id: "model-a", type: "model", is_enabled: true }], has_more: false };
      }
      if (clean === "/api/v1/cloud/sessions" && method === "POST") {
        const session = createSession(opts.body);
        return { id: session.id, type: "session", status: session.status, metadata: session.metadata, archived_at: null };
      }
      if (clean === "/api/v1/cloud/sessions" && method === "GET") {
        return { data: [...sessions.values()].map((s) => ({ id: s.id, metadata: s.metadata, archived_at: s.archived_at, status: s.status })), has_more: false };
      }
      const sessionMatch = /^\/api\/v1\/cloud\/sessions\/([^/]+)(\/.*)?$/.exec(clean);
      if (!sessionMatch) throw new CloudAgentsError("ai_request_invalid", 400, "rejected");
      const session = sessions.get(sessionMatch[1]);
      if (!session) throw new CloudAgentsError("ai_resource_not_found", 404, "rejected");
      const sub = sessionMatch[2] ?? "";
      if (sub === "" && method === "GET") {
        return { id: session.id, status: session.status, archived_at: session.archived_at, metadata: session.metadata };
      }
      if (sub === "/archive" && method === "POST") {
        session.archived_at = new Date().toISOString();
        return { id: session.id, status: session.status, archived_at: session.archived_at };
      }
      if (sub === "/cancel" && method === "POST") {
        session.status = "idle";
        return { id: session.id, type: "session", status: "canceling" };
      }
      if (sub === "/events" && method === "POST") {
        const incoming = opts.body?.events ?? [];
        const accepted = incoming.map((event) => {
          const stored = { ...event, id: nextId("evt"), processed_at: new Date().toISOString() };
          session.events.push(stored);
          return stored;
        });
        react(session, incoming);
        return { data: accepted };
      }
      if (sub === "/events" && method === "GET") {
        let data = [...session.events];
        if (query.order === "desc") data.reverse();
        if (query.after_id) {
          const index = session.events.findIndex((e) => e.id === query.after_id);
          data = session.events.slice(index + 1);
        }
        if (query.before_id) {
          const index = session.events.findIndex((e) => e.id === query.before_id);
          data = session.events.slice(0, index);
          if (query.order === "desc") data.reverse();
        }
        const limit = Number(query.limit ?? 20);
        return { data: data.slice(0, limit), has_more: false, first_id: data[0]?.id ?? null, last_id: data[data.length - 1]?.id ?? null };
      }
      throw new CloudAgentsError("ai_request_invalid", 400, "rejected");
    },
    async openStream(sessionId, opts = {}) {
      const session = sessions.get(sessionId);
      if (!session) throw new CloudAgentsError("ai_resource_not_found", 404, "rejected");
      let start = 0;
      if (opts.lastEventId) {
        const index = session.events.findIndex((e) => e.id === opts.lastEventId);
        start = index + 1;
      }
      const buffered = session.events.slice(start);
      const body = new ReadableStream({
        start(controller) {
          for (const event of buffered) controller.enqueue(encodeSSE(event.type, event));
          controller.close();
        },
      });
      return { body, close() {} };
    },
    async findResources() { return { matches: [], complete: true }; },
    _sessions: sessions,
  };
  return client;
}