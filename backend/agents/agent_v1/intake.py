from backend.agents.intake import IntakeAgent
from backend.config import settings
from backend.legal.retriever import LegalRetriever, case_region_scope
from backend.models.case import Message
from backend.services.facts import build_case_title, required_progress
from .runtime import AgentState
from .boundary import ScopedAgentRuntime


class AgentIntake(IntakeAgent):
    """Adapter to existing case/message API; runtime owns no database transactions."""

    def start_case(self, case):
        case.intake = {"confirmed": False, "unknowns": {}, "skipped": [], "agent_stage": "waiting_user"}
        message = Message(case_id=case.id, role="assistant",
                          content="你好，工资没结清的话，可以跟我说说。我帮你把账和下一步理清楚。",
                          meta={"kind": "question", "provider": self.provider.display_name, "provider_is_mock": False})
        case.messages.append(message)
        self.db.flush()
        return message

    def handle_message(self, case, text, emit=None):
        intake = dict(case.intake or {})
        history = [{"role": msg.role, "content": msg.content} for msg in case.messages if msg.role in ("user", "assistant")]
        # Router has already appended the current user message.
        if history and history[-1] == {"role": "user", "content": text}:
            history.pop()
        state = AgentState(facts=dict(case.facts), sources=dict(case.facts_meta),
                           stage=intake.get("agent_stage", "waiting_user"), history=history,
                           citations=intake.get("agent_citations", {}), memory=intake.get("agent_memory", {}),
                           materials=intake.get("agent_materials", {}))
        region_scope = case_region_scope(case.facts)
        runtime = ScopedAgentRuntime(self.provider, lambda query: LegalRetriever(self.db).search(query, top_k=4, region=region_scope),
                               max_steps=settings.agent_max_steps)
        result = runtime.run(state, text, emit=emit)
        case.facts = result.state.facts
        case.facts_meta = result.state.sources
        confirmed = result.state.stage == "ready" or (bool(intake.get("confirmed")) and not result.changed_facts)
        case.intake = {**intake, "agent_stage": result.state.stage, "confirmed": confirmed,
                       "agent_memory": result.state.memory, "agent_materials": result.state.materials,
                       "agent_citations": result.state.citations, "last_question_key": None}
        if result.changed_facts:
            case.plan_generated_at = None
        case.status = "ready" if confirmed else "collecting"
        case.title = build_case_title(case.facts)
        question = {"key": "agent", "text": result.next_question, "quick_replies": []} if result.next_question else None
        message = Message(case_id=case.id, role="assistant", content=result.reply,
                          meta={"kind": "question" if question else "summary", "question": question,
                                "quick_replies": [], "provider": self.provider.display_name, "provider_is_mock": False,
                                "updated_facts": result.changed_facts, "agent_stage": result.state.stage,
                                "agent_trace": result.trace, "usage": result.usage, "citations": result.citations, "run_id": result.run_id})
        case.messages.append(message)
        self.db.flush()
        return {"message": message, "question": question, "progress": required_progress(case.facts, case.intake)}
