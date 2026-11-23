from sqlalchemy.orm import Session

from backend.legal.retriever import LegalRetriever, case_region_scope
from backend.models.case import Case

CORE_PROVISION_IDS = [
    "mwpr-16",
    "mwpr-30",
    "mwpr-36",
    "mwpr-28",
    "lsr-11",
    "lsr-26",
    "lcl-30",
    "lcl-82",
    "lcl-10",
    "lcl-85",
    "ldal-27",
    "lal-31",
]

HENAN_CORE_PROVISION_IDS = [
    "hnlsr-15",
    "hnlsr-16",
    "hnlsr-21",
    "hnzh-16",
    "hnzh-13",
    "hnbzj-26",
]

RELEVANCE = {
    "mwpr-16": "用人单位拖欠农民工工资的，应当依法予以清偿，与欠薪事实直接相关。",
    "mwpr-30": "在工程建设领域，如存在分包单位拖欠工资，施工总承包单位可能承担先行清偿责任；需核实分包关系和总包身份。",
    "mwpr-36": "如果工程被发包、分包给个人或不具备合法经营资格的单位，建设单位或施工总承包单位可能承担清偿责任；需核实发包链条。",
    "mwpr-28": "施工总承包或分包单位应依法订立劳动合同并进行用工实名登记，与“没签合同、没有考勤”的情况相关。",
    "lsr-11": "支付劳动者工资属于劳动保障监察事项，是向人社部门投诉的法律依据之一。",
    "lsr-26": "劳动保障行政部门可责令限期支付；逾期不支付的，可能加付赔偿金。",
    "lcl-30": "用人单位应及时足额支付劳动报酬，欠薪时可依法主张权利。",
    "lcl-82": "如双方构成劳动关系且超过一个月未签书面合同，可能涉及二倍工资；建筑领域包工头招用情形需先核实关系性质。",
    "lcl-10": "建立劳动关系应订立书面劳动合同，与未签合同的情况相关；是否构成劳动关系需核实。",
    "lcl-85": "用人单位未及时足额支付劳动报酬的，劳动行政部门可责令限期支付，逾期可能加付赔偿金。",
    "ldal-27": "申请劳动仲裁通常有一年时效；拖欠劳动报酬且劳动关系已终止的，应自终止之日起一年内提出。",
    "lal-31": "请求支付劳动报酬、确认劳动关系，符合条件的可以申请法律援助。",
    "mwpr-24": "建设单位与施工总承包单位应约定人工费用拨付周期，人工费用拨付周期不得超过1个月。",
    "mwpr-31": "工程建设领域推行总包代发工资，工资支付表和专用账户可用于核实付款主体。",
    "lsr-20": "违反劳动保障法律的行为超过2年未被发现、举报或投诉的，劳动保障监察可能不再查处。",
    "mwpr-3": "农民工有按时足额获得工资的权利，任何单位和个人不得拖欠农民工工资。",
    "mwpr-6": "用人单位应实行实名制管理，并与农民工书面约定工资支付标准、时间、方式。",
    "mwpr-7": "人社部门查处欠薪案件，住建等行业主管部门督办违法发包、转包、分包、挂靠、拖欠工程款导致的欠薪；与“投诉找谁”相关。",
    "mwpr-12": "用人单位应按约定的工资支付周期和具体支付日期足额支付工资，与欠薪事实直接相关。",
    "mwpr-42": "人社部门作出责令支付决定后相关单位不支付的，可依法申请人民法院强制执行。",
    "hnlsr-15": "河南省内投诉举报劳动保障违法行为的，监察机构应在七日内决定是否立案并通知投诉人；属于劳动争议的应告知仲裁诉讼途径。",
    "hnlsr-16": "河南省内劳动保障监察查处一般自立案之日起三十日内结案，复杂案件经批准最多延长三十日。",
    "hnlsr-21": "河南省内用人单位克扣拖欠工资等情形，劳动保障行政部门可责令限期支付，并可责令按工资报酬和经济补偿总和的一至五倍支付赔偿金；需先经行政处理程序。",
    "hnzh-16": "河南省工程建设领域总包单位对农民工工资支付负总责，推行分包单位农民工工资委托总包代发。",
    "hnzh-13": "河南省内建设单位应按约定将人工费用拨付到总包专用账户，拨付周期不得超过1个月；未按约定拨付的纳入欠薪预警。",
    "hnbzj-26": "河南省内工程拖欠农民工工资，经人社部门责令限期清偿或先行清偿而总包到期拒不履行的，可动用工资保证金或保函直接支付被拖欠工资。",
}


class LegalResearchAgent:
    name = "Legal Research Agent"

    def __init__(self, db: Session) -> None:
        self.db = db
        self.retriever = LegalRetriever(db)

    def run(self, case: Case) -> dict:
        facts = case.facts
        scope = case_region_scope(facts)
        core_ids = CORE_PROVISION_IDS + HENAN_CORE_PROVISION_IDS if scope == "henan" else CORE_PROVISION_IDS
        query = self._build_query(facts)
        core = self.retriever.get_many(core_ids)
        retrieved = self.retriever.search(query, top_k=10, min_score=0.5, region=scope)
        merged: dict[str, dict] = {}
        for item in core:
            item = dict(item)
            item["source_type"] = "core"
            item["why_relevant"] = RELEVANCE.get(item["id"], "")
            item["verification_label"] = self._verification_label(item["verification_status"])
            merged[item["id"]] = item
        for item in retrieved:
            if item["id"] in merged:
                merged[item["id"]]["score"] = item["score"]
                continue
            item = dict(item)
            item["source_type"] = "retrieved"
            item["why_relevant"] = RELEVANCE.get(
                item["id"], "该条文与你描述的欠薪、用工或维权渠道相关，建议结合完整事实核对。"
            )
            item["verification_label"] = self._verification_label(item["verification_status"])
            merged[item["id"]] = item
        provisions = sorted(
            merged.values(),
            key=lambda item: (item["source_type"] != "core", core_ids.index(item["id"]) if item["id"] in core_ids else 99),
        )[: 20 if scope == "henan" else 12]
        documents = self.retriever.all_documents()
        return {
            "query": query,
            "provisions": provisions,
            "documents": documents,
            "verification_summary": self._verification_summary(provisions),
            "disclaimer": "法律条文来自本地知识库。标注为“待核验”的内容不得作为最终法律依据，请以官方原文和主管部门认定为准。",
            "agent": self.name,
        }

    @staticmethod
    def _build_query(facts: dict) -> str:
        scope = case_region_scope(facts)
        parts = [
            "建筑工地",
            "农民工",
            "欠薪",
            "包工头",
            "分包",
            "施工总承包",
        ]
        if scope == "henan":
            parts.insert(0, "河南")
            if facts.get("location_city"):
                parts.append(facts["location_city"])
            if facts.get("location_district"):
                parts.append(facts["location_district"])
        elif scope == "national":
            if facts.get("location_province"):
                parts.append(facts["location_province"])
            if facts.get("location_city"):
                parts.append(facts["location_city"])
        if facts.get("work_type"):
            parts.append(facts["work_type"])
        if facts.get("has_contract") != "yes":
            parts.append("没有签订劳动合同 未签合同 二倍工资")
        if facts.get("evidence"):
            parts.append("证据 考勤 工资表 聊天记录")
        if facts.get("prior_report") == "no":
            parts.append("投诉 劳动保障监察")
        if facts.get("recruiter_type") == "包工头":
            parts.append("个人包工头 违法分包 清偿")
        parts.append("劳动仲裁 时效 法律援助")
        return " ".join(parts)

    @staticmethod
    def _verification_label(status: str) -> str:
        return {
            "verified": "已核验",
            "transcribed": "按公开发布文本整理，待逐条核验",
            "pending": "待核验",
        }.get(status, "待核验")

    @staticmethod
    def _verification_summary(provisions: list[dict]) -> dict:
        pending = [item["id"] for item in provisions if item["verification_status"] == "pending"]
        transcribed = [
            item["id"] for item in provisions if item["verification_status"] == "transcribed"
        ]
        return {
            "total": len(provisions),
            "verified": len(provisions) - len(pending) - len(transcribed),
            "transcribed": len(transcribed),
            "pending": len(pending),
            "pending_ids": pending,
            "note": "国家法条部分已按官方公布全文核验，其余按公开发布文本整理待逐条核验；河南地方条文已按官方原文核验，办事指南类条目仍为待核验。标注“待核验”的内容不作为最终法律依据。",
        }
