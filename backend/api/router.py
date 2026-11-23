from copy import deepcopy
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy.orm import Session

from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.provider import build_provider, provider_payload
from backend.agents.session_settings import session_provider
from backend.api.deps import get_owned_case, get_session_id
from backend.api.schemas import (
    CreateCaseRequest,
    SendMessageRequest,
    UpdateFactsRequest,
    UpdateStepRequest,
)
from backend.api.serializers import serialize_case, serialize_case_brief, serialize_message
from backend.database.db import get_db
from backend.legal.loader import load_regions
from backend.legal.retriever import LegalRetriever
from backend.models.case import ActionStep, Case, Message
from backend.models.legal import Channel
from backend.rules.evidence import EVIDENCE_CATALOG
from backend.rules.regions import REGION_INDEX
from backend.services.demo import create_demo_case
from backend.services.export import build_plain_text, to_docx, to_pdf
from backend.services.fact_extractor import NEW_CASE_FACTS
from backend.services.facts import build_case_title, record_fact_change, required_progress

router = APIRouter()


def _provider(session_id: str):
    return session_provider(session_id) or build_provider()

EDITABLE_FACTS = set(NEW_CASE_FACTS.keys()) - {"scene"}
NUMERIC_FACTS = {
    "daily_wage",
    "monthly_wage",
    "unit_price",
    "agreed_amount",
    "paid_amount",
    "owed_amount",
    "duration_months",
}
BOOLEAN_FACTS = {"owed_amount_approx", "outside_scope"}
EVIDENCE_KEYS = {item["key"] for item in EVIDENCE_CATALOG}

SCENES = [
    {
        "id": "construction_wage_arrears",
        "title": "工资一直没拿到",
        "description": "建筑工地、包工头、总包分包场景的欠薪线索整理。",
        "status": "available",
        "tag": "首期完整支持",
    },
    {
        "id": "wage_deduction",
        "title": "工资被克扣",
        "description": "无故扣款、罚款、少算工天等场景，正在整理法律和办事规则。",
        "status": "coming_soon",
        "tag": "后续开放",
    },
    {
        "id": "overtime",
        "title": "加班没有报酬",
        "description": "加班费计算和举证规则正在整理。",
        "status": "coming_soon",
        "tag": "后续开放",
    },
    {
        "id": "work_injury",
        "title": "工作中受伤",
        "description": "工伤认定、劳动能力鉴定和赔偿路径复杂，首期暂不开放。",
        "status": "coming_soon",
        "tag": "后续开放",
    },
    {
        "id": "unfair_dismissal",
        "title": "被无故辞退",
        "description": "违法解除、经济补偿和仲裁规则正在整理。",
        "status": "coming_soon",
        "tag": "后续开放",
    },
    {
        "id": "other",
        "title": "其他劳动权益问题",
        "description": "社保、平台就业等场景将在后续版本逐步开放。",
        "status": "coming_soon",
        "tag": "后续开放",
    },
]


@router.get("/health")
def health() -> dict:
    provider = build_provider()
    return {
        "status": "ok",
        "service": "WorkerRights API",
        "provider": provider_payload(provider),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/meta")
def meta(x_session_id: str | None = Header(default=None)) -> dict:
    if x_session_id is not None:
        get_session_id(x_session_id)
    provider = _provider(x_session_id) if x_session_id else build_provider()
    return {
        "product_name": "工友权益助手",
        "service_region": "河南省",
        "scene": "建筑工地欠薪",
        "scenes": SCENES,
        "cities": [city["name"] for city in REGION_INDEX.values()],
        "provider": provider_payload(provider),
        "evidence_catalog": EVIDENCE_CATALOG,
        "privacy": {
            "session_scoped": True,
            "stores_id_card": False,
            "asks_for_phone": False,
            "file_upload": "本版本不在本产品服务器保存身份证、银行卡或聊天截图原件，官方填报材料请直接在官方平台提交。",
            "deletion": "支持在“我的案件”中删除案件及聊天记录。",
        },
        "limitations": [
            "首期完整支持河南省建筑工地欠薪场景，其他场景显示为待开放。",
            "不自动登录、不自动提交任何政府平台。",
            "本地法律知识库中的河南地方政策均为待核验，不作为最终法律依据。",
            "本产品不承诺追回工资或胜诉。",
        ],
        "disclaimer": "工友权益助手提供信息整理、法律资料检索和办事路径参考，不构成正式法律意见。复杂案件请拨打12348或咨询专业律师。",
    }


@router.post("/cases", status_code=201)
def create_case(
    payload: CreateCaseRequest | None = None,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    scene = payload.scene if payload else "construction_wage_arrears"
    if scene != "construction_wage_arrears":
        raise HTTPException(status_code=400, detail="首期仅完整支持建筑工地欠薪场景。")
    orchestrator = AgentOrchestrator(db, _provider(session_id))
    case = orchestrator.create_case(session_id, scene)
    return {"case": serialize_case(case), "provider": orchestrator.provider.health()}


@router.get("/cases")
def list_cases(
    session_id: str = Depends(get_session_id), db: Session = Depends(get_db)
) -> dict:
    cases = (
        db.query(Case)
        .filter(Case.session_id == session_id)
        .order_by(Case.updated_at.desc())
        .all()
    )
    return {"cases": [serialize_case_brief(case) for case in cases]}


@router.get("/cases/{case_id}")
def get_case(
    case_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    return {"case": serialize_case(case)}


@router.delete("/cases/{case_id}")
def delete_case(
    case_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    db.delete(case)
    db.commit()
    return {"deleted": True, "case_id": case_id}


@router.post("/cases/{case_id}/messages")
def send_message(
    case_id: str,
    payload: SendMessageRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    return process_message(case_id, payload, session_id, db)


def process_message(case_id, payload, session_id, db, emit=None) -> dict:
    case = get_owned_case(db, case_id, session_id)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="消息不能为空。")
    provider = _provider(session_id)
    user_message = Message(
        case_id=case.id,
        role="user",
        content=content,
        meta={"provider": provider.display_name, "provider_is_mock": provider.is_mock},
    )
    case.messages.append(user_message)
    db.flush()
    orchestrator = AgentOrchestrator(db, provider)
    try:
        result = orchestrator.handle_message(case, content, emit=emit)
    except Exception:
        db.rollback()
        raise
    return {
        "user_message": serialize_message(user_message),
        "assistant_message": serialize_message(result["message"]),
        "case": serialize_case(case),
        "next_question": result.get("question"),
        "progress": result.get("progress"),
        "status": case.status,
        "provider": result.get("provider"),
    }


@router.patch("/cases/{case_id}/facts")
def update_facts(
    case_id: str,
    payload: UpdateFactsRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    updates = payload.facts or {}
    unknown_keys = set(updates) - EDITABLE_FACTS
    if unknown_keys:
        raise HTTPException(status_code=400, detail=f"不允许修改的字段：{sorted(unknown_keys)}")

    normalized: dict = {}
    for key, value in updates.items():
        if key in NUMERIC_FACTS:
            if value in (None, ""):
                normalized[key] = None
            else:
                try:
                    number = float(value)
                except (TypeError, ValueError) as exc:
                    raise HTTPException(status_code=400, detail=f"{key} 必须是数字。") from exc
                normalized[key] = int(number) if number.is_integer() else number
        elif key in BOOLEAN_FACTS:
            normalized[key] = bool(value)
        elif key == "evidence":
            if value is None:
                normalized[key] = []
            elif isinstance(value, list):
                invalid = [item for item in value if item not in EVIDENCE_KEYS]
                if invalid:
                    raise HTTPException(status_code=400, detail=f"未知证据类型：{invalid}")
                normalized[key] = value
            else:
                raise HTTPException(status_code=400, detail="evidence 必须是数组。")
        elif key == "has_contract":
            if value not in (None, "", "yes", "no", "unknown"):
                raise HTTPException(status_code=400, detail="has_contract 取值无效。")
            normalized[key] = value or None
        elif key == "prior_report":
            if value not in (None, "", "yes", "no"):
                raise HTTPException(status_code=400, detail="prior_report 取值无效。")
            normalized[key] = value or None
        elif isinstance(value, str):
            normalized[key] = value.strip() or None
        else:
            normalized[key] = value

    before = deepcopy(case.facts)
    case.facts = {**case.facts, **normalized}
    if case.facts.get("location_city"):
        city = REGION_INDEX.get(case.facts["location_city"])
        if city:
            case.facts["location_province"] = "河南省"
            district = case.facts.get("location_district")
            if district and district not in city["districts"]:
                case.facts["location_district"] = None
    case.title = build_case_title(case.facts)

    intake = dict(case.intake or {})
    unknowns = dict(intake.get("unknowns", {}))
    mapping = {
        "location_city": "location",
        "location_district": "district",
        "work_type": "work_type",
        "duration_text": "period",
        "work_start": "period",
        "work_end": "period",
        "recruiter_type": "recruiter",
        "manager_role": "manager",
        "wage_basis": "wage_basis",
        "owed_amount": "owed_amount",
        "agreed_amount": "amounts",
        "paid_amount": "amounts",
        "has_contract": "contract",
        "evidence": "evidence",
        "project_name": "project_info",
        "contractor_name": "project_info",
        "prior_report": "prior_report",
    }
    for key in normalized:
        question_key = mapping.get(key)
        if question_key:
            unknowns.pop(question_key, None)
    intake["unknowns"] = unknowns
    case.intake = intake

    changed = record_fact_change(case, before)

    orchestrator = AgentOrchestrator(db, _provider(session_id))
    next_question = None
    if changed and not orchestrator.provider.is_mock:
        case.intake = {**case.intake, "confirmed": False, "agent_stage": "waiting_user"}
        case.status = "collecting"
        case.plan_generated_at = None
    elif orchestrator.provider.is_mock and case.status == "collecting":
        question = orchestrator.intake.next_question(case)
        next_question = question
        case.intake["last_question_key"] = question["key"] if question else None
    content = "案件信息已更新，我会根据新的信息重新整理分析和行动指南。"
    if next_question:
        content += "\n\n" + next_question["text"]
    message = Message(
        case_id=case.id,
        role="assistant",
        content=content,
        meta={
            "kind": "question" if next_question else "facts_updated",
            "question": next_question,
            "quick_replies": next_question["quick_replies"] if next_question else [],
            "updated_keys": list(normalized.keys()),
            "demo": case.is_demo,
        },
    )
    case.messages.append(message)
    db.flush()
    db.commit()
    db.refresh(case)
    return {
        "case": serialize_case(case),
        "message": serialize_message(message),
        "next_question": next_question,
        "progress": required_progress(case.facts, case.intake or {}),
    }


def _all_required(case: Case) -> bool:
    facts = case.facts
    checks = [
        bool(facts.get("location_city")),
        bool(facts.get("work_type")),
        bool(facts.get("duration_text") or facts.get("work_start")),
        bool(facts.get("recruiter_type")),
        bool(facts.get("manager_role")),
        bool(facts.get("wage_basis")),
        bool(facts.get("owed_amount") or facts.get("owed_amount_note")),
        facts.get("paid_amount") is not None,
        bool(facts.get("has_contract")),
        bool(facts.get("evidence") or facts.get("evidence_status")),
    ]
    return all(checks)


@router.get("/cases/{case_id}/legal-basis")
def legal_basis(
    case_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    return AgentOrchestrator(db, _provider(session_id)).get_legal_basis(case)


@router.get("/cases/{case_id}/analysis")
def get_analysis(
    case_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    analysis = AgentOrchestrator(db, _provider(session_id)).get_analysis(case)
    analysis["preliminary"] = not bool((case.intake or {}).get("confirmed"))
    if analysis["preliminary"]:
        analysis["preliminary_note"] = "案件信息尚未确认，以下分析会随后续补充和修改更新。"
    return analysis


@router.get("/cases/{case_id}/action-plan")
def get_action_plan(
    case_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    orchestrator = AgentOrchestrator(db, _provider(session_id))
    plan = orchestrator.ensure_action_plan(case)
    plan["preliminary"] = not bool((case.intake or {}).get("confirmed"))
    if plan["preliminary"]:
        plan["preliminary_note"] = "案件信息尚未确认，行动指南为初步版本，请先补充并核对信息。"
    plan["case_status"] = case.status
    return plan


@router.patch("/cases/{case_id}/action-plan/steps/{step_id}")
def update_action_step(
    case_id: str,
    step_id: str,
    payload: UpdateStepRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    plan = AgentOrchestrator(db, _provider(session_id)).ensure_action_plan(case)
    if plan["generated_from_revision"] != case.facts_revision:
        raise HTTPException(
            status_code=409,
            detail="信息已更新，请重新生成。请返回对话重新核对并确认案件信息后，再勾选行动步骤。",
        )
    step = (
        db.query(ActionStep)
        .filter(ActionStep.id == step_id, ActionStep.case_id == case.id)
        .first()
    )
    if not step:
        raise HTTPException(status_code=404, detail="步骤不存在。")
    step.done = payload.done
    step.done_at = datetime.now(timezone.utc) if payload.done else None
    db.flush()
    db.refresh(step)
    for item in plan["steps"]:
        if item["id"] == step.id:
            item["done"] = step.done
            item["done_at"] = step.done_at.isoformat() if step.done_at else None
    done = sum(1 for item in plan["steps"] if item["done"])
    total = len(plan["steps"])
    plan["progress"] = {"done": done, "total": total, "percent": round(done / total * 100) if total else 0}
    case.derived_results = {**case.derived_results, "action_plan": deepcopy(plan)}
    db.commit()
    plan["preliminary"] = not bool((case.intake or {}).get("confirmed"))
    if plan["preliminary"]:
        plan["preliminary_note"] = "案件信息尚未确认，行动指南为初步版本，请先补充并核对信息。"
    plan["case_status"] = case.status
    return plan


@router.get("/cases/{case_id}/form-assistant")
def get_form_assistant(
    case_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> dict:
    case = get_owned_case(db, case_id, session_id)
    form = AgentOrchestrator(db, _provider(session_id)).get_form_assistant(case)
    form["preliminary"] = not bool((case.intake or {}).get("confirmed"))
    if form["preliminary"]:
        form["preliminary_note"] = "案件信息尚未确认，部分字段会显示为待补充或待核实。"
    return form


@router.get("/cases/{case_id}/export/{fmt}")
def export_case(
    case_id: str,
    fmt: Literal["docx", "pdf", "txt"],
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
) -> Response:
    case = get_owned_case(db, case_id, session_id)
    if any(
        result["generated_from_revision"] != case.facts_revision
        for result in case.derived_results.values()
    ):
        raise HTTPException(
            status_code=409,
            detail="信息已更新，请重新生成。请返回对话重新核对并确认案件信息后，再导出材料。",
        )
    orchestrator = AgentOrchestrator(db, _provider(session_id))
    analysis = orchestrator.get_analysis(case)
    plan = orchestrator.ensure_action_plan(case)
    if fmt == "docx":
        content = to_docx(case, analysis, plan)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif fmt == "pdf":
        content = to_pdf(case, analysis, plan)
        media_type = "application/pdf"
    else:
        content = build_plain_text(case, analysis, plan).encode("utf-8")
        media_type = "text/plain; charset=utf-8"
    filename = f"workerrights-case-{case.id}.{fmt}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/cases/demo", status_code=201)
def create_demo(
    session_id: str = Depends(get_session_id), db: Session = Depends(get_db)
) -> dict:
    case = create_demo_case(db, session_id)
    return {"case": serialize_case(case), "is_demo": True}


@router.get("/legal/search")
def legal_search(
    q: str = Query(min_length=1, max_length=300),
    top_k: int = Query(default=8, ge=1, le=20),
    region: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    if region is not None and region not in ("henan", "national"):
        raise HTTPException(status_code=422, detail="region 仅支持 henan 或 national。")
    retriever = LegalRetriever(db)
    return {
        "query": q,
        "results": retriever.search(q, top_k=top_k, region=region),
        "disclaimer": "检索结果来自本地知识库；地方条文以工地所在地为准，请以官方原文为准。",
    }


@router.get("/legal/documents")
def legal_documents(db: Session = Depends(get_db)) -> dict:
    retriever = LegalRetriever(db)
    return {
        "documents": retriever.all_documents(),
        "note": "verification_status: verified=已核验；transcribed=按公开发布文本整理待逐条核验；pending=待核验。",
    }


@router.get("/regions/henan")
def henan_regions() -> dict:
    tree = load_regions()
    return {
        "province": tree["province"],
        "cities": [
            {
                "name": city["name"],
                "code": city["code"],
                "districts": [
                    (district if isinstance(district, str) else district[0])
                    for district in city["districts"]
                ],
            }
            for city in tree["cities"]
        ],
        "note": "行政区划精确到县区；具体维权受理机构需按管辖规则核实，并非每个区县都有独立机构。",
    }


@router.get("/channels")
def list_channels(db: Session = Depends(get_db)) -> dict:
    channels = db.query(Channel).order_by(Channel.priority).all()
    return {
        "channels": [
            {
                "id": channel.id,
                "name": channel.name,
                "category": channel.category,
                "scope": channel.scope,
                "priority": channel.priority,
                "description": channel.description,
                "official_url": channel.official_url,
                "access_note": channel.access_note,
                "jurisdiction_rule": channel.jurisdiction_rule,
                "verification_status": channel.verification_status,
                "last_verified_at": channel.last_verified_at,
                "source_note": channel.source_note,
                "legal_basis": channel.legal_basis,
            }
            for channel in channels
        ],
        "note": "渠道入口和管辖规则以官方最新公布为准。",
    }
