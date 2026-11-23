import { analyzeEvidence } from "./evidence.ts";
import { buildRelationship, formatAmount, locationText, requiredProgress, workPeriodText } from "./facts.ts";
import { runLegalResearch } from "./legal_research.ts";
import type { LegalRetriever } from "./retriever.ts";
import type { CaseRow, Facts } from "./types.ts";
import { nowIso, truthy } from "./util.ts";

function basicInfo(facts: Facts): Array<Record<string, unknown>> {
  const location = locationText(facts);
  const period = workPeriodText(facts);
  const wageParts: string[] = [];
  if (facts.wage_basis) wageParts.push(String(facts.wage_basis));
  if (facts.daily_wage) wageParts.push(`每天${formatAmount(facts.daily_wage)}`);
  if (facts.monthly_wage) wageParts.push(`每月${formatAmount(facts.monthly_wage)}`);
  if (facts.unit_price) wageParts.push(`单价${formatAmount(facts.unit_price)}`);
  if (facts.agreed_amount) wageParts.push(`约定总额${formatAmount(facts.agreed_amount)}`);
  let contract: string;
  if (facts.has_contract === "yes") contract = "已签书面合同";
  else if (facts.has_contract === "no") contract = "未签书面合同";
  else contract = "待核实";
  const recruiter = [facts.recruiter_type, facts.recruiter_name].filter((part) => truthy(part)).join(" / ") || "待核实";
  return [
    { key: "location", label: "工作地点", value: location, status: facts.location_city ? "known" : "unknown" },
    { key: "work_type", label: "工作类型", value: facts.work_type || "待核实", status: facts.work_type ? "known" : "unknown" },
    { key: "period", label: "工作时间", value: period, status: (facts.work_start || facts.duration_text) ? "known" : "unknown" },
    { key: "wage", label: "工资约定", value: wageParts.length ? wageParts.join("，") : "待核实", status: wageParts.length ? "known" : "unknown" },
    { key: "paid", label: "已支付金额", value: facts.paid_amount !== null && facts.paid_amount !== undefined ? formatAmount(facts.paid_amount) : "待核实", status: facts.paid_amount !== null && facts.paid_amount !== undefined ? "known" : "unknown" },
    {
      key: "owed",
      label: "拖欠金额",
      value: facts.owed_amount !== null && facts.owed_amount !== undefined ? formatAmount(facts.owed_amount, Boolean(facts.owed_amount_approx)) : "待核实",
      status: facts.owed_amount_approx ? "approx" : (facts.owed_amount !== null && facts.owed_amount !== undefined ? "known" : "unknown"),
      note: facts.owed_amount_note ?? null,
    },
    { key: "recruiter", label: "招用方式", value: recruiter, status: facts.recruiter_type ? "known" : "unknown" },
    { key: "manager", label: "日常管理", value: facts.manager_role || "待核实", status: facts.manager_role ? "known" : "unknown" },
    { key: "contract", label: "书面合同", value: contract, status: facts.has_contract ? "known" : "unknown" },
  ];
}

function riskFlags(facts: Facts): Array<Record<string, unknown>> {
  const risks: Array<Record<string, unknown>> = [];
  if (facts.owed_amount_approx) {
    risks.push({
      level: "attention",
      title: "欠薪金额仍是约数",
      detail: "你提供的金额为“约数”，建议按工作天数、单价和已付款逐项核对，在投诉和仲裁材料中注明“约”，避免被认定为夸大。",
    });
  }
  if (!facts.project_name && !facts.contractor_name) {
    risks.push({
      level: "attention",
      title: "项目或总包单位尚未确认",
      detail: "缺少项目名称或施工总承包单位信息，可能影响确定管辖和核查对象。可从工地公示牌、工牌、工资表、工友处继续了解。",
    });
  }
  if (facts.has_contract !== "yes") {
    risks.push({
      level: "attention",
      title: "书面合同情况不明或未签",
      detail: "未签书面合同不影响主张欠薪，但需要更多证据证明用工关系、工资约定和工作量。",
    });
  }
  if (facts.recruiter_type === "包工头") {
    risks.push({
      level: "attention",
      title: "个人包工头招用，关系性质待核实",
      detail: "由个人包工头直接招用时，劳动关系还是劳务关系、谁是工资支付责任主体，需要结合管理和付款事实核实，不能仅凭称呼判断。",
    });
  }
  if (!facts.location_district) {
    risks.push({
      level: "attention",
      title: "区县未确认，受理机构需进一步核实",
      detail: "建议通过12333确认项目所在地对应的劳动保障监察机构；并非每个区县都有完全独立的受理机构。",
    });
  }
  if (!truthy(facts.evidence)) {
    risks.push({
      level: "info",
      title: "书面证据较少",
      detail: "可以先固定聊天记录、工友证言、工作照片和转账记录。缺少某项材料不等于无法维权。",
    });
  }
  if (!facts.work_end) {
    risks.push({
      level: "attention",
      title: "工作结束时间未明确，注意时效",
      detail: "劳动保障监察一般有2年查处时效，劳动仲裁一般有1年时效。具体起算和中断需结合你的情况核实，建议尽早咨询和提交。",
      legal_basis: ["lsr-20", "ldal-27"],
    });
  }
  risks.push({
    level: "info",
    title: "用工关系图不等于责任认定",
    detail: "关系图只反映你目前提供的信息，建设单位、总包、分包责任需由行政机关或仲裁、司法机关依法认定。",
  });
  return risks;
}

function rights(facts: Facts): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [
    {
      id: "wage",
      title: "追索被拖欠的工资",
      description: "你陈述的劳动报酬尚未足额支付，可以要求责任主体支付欠薪。具体金额和支付主体需核对。",
      status: "核心诉求",
      basis: ["mwpr-16", "lcl-30"],
    },
    {
      id: "advance-payment",
      title: "施工总承包单位先行清偿（需核实）",
      description: "如能核实工程属于工程建设领域，且存在分包单位拖欠工资，施工总承包单位可能承担先行清偿责任。该规则不当然等于最终责任由总包承担。",
      status: "需核实后判断",
      basis: ["mwpr-30", "mwpr-36"],
    },
    {
      id: "additional-compensation",
      title: "加付赔偿金（需满足程序条件）",
      description: "通常需要劳动保障行政部门责令限期支付后，用人单位逾期仍不支付，才可能涉及加付赔偿金；不是在投诉时自动获得。",
      status: "条件未满足前不能确定",
      basis: ["lsr-26", "lcl-85"],
    },
  ];
  if (facts.has_contract !== "yes") {
    items.push({
      id: "double-wage",
      title: "未签书面劳动合同的二倍工资（需先确认劳动关系）",
      description: "如双方构成劳动关系且超过一个月未签书面合同，可能涉及二倍工资差额。但建筑领域由个人包工头招用时，是否构成劳动关系需结合管理和付款事实核实。",
      status: "需先核实劳动关系",
      basis: ["lcl-82", "lcl-10"],
    });
  }
  items.push({
    id: "legal-aid",
    title: "申请法律咨询或法律援助",
    description: "请求支付劳动报酬、确认劳动关系属于法律援助事项范围；是否符合经济困难等条件，由法律援助机构审核。",
    status: "可咨询",
    basis: ["lal-31"],
  });
  return items;
}

function legalAnalysis(facts: Facts, provisions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];
  for (const provision of provisions) {
    const provisionId = provision.id as string;
    if (provisionId === "lcl-82" && facts.has_contract === "yes") continue;
    if (provisionId === "mwpr-28" && facts.has_contract === "yes" && truthy(facts.evidence)) continue;
    const supporting: string[] = [];
    const pending: string[] = [];
    let applicability = "需结合事实核实后判断";

    if (provisionId === "mwpr-16" || provisionId === "lcl-30") {
      supporting.push(`你陈述在${locationText(facts)}提供劳动，尚有工资未支付。`);
      pending.push("需要核对准确的应付、已付和欠付金额，以及工资支付主体。");
      applicability = "与欠薪诉求直接相关";
    } else if (provisionId === "mwpr-30") {
      if (facts.recruiter_type === "包工头" || facts.subcontractor_name) {
        supporting.push("你描述由包工头或劳务方招用，可能存在分包/劳务用工链条。");
        applicability = "可能涉及，需核实总包和分包关系";
      }
      pending.push("施工总承包单位是谁", "分包关系是否真实存在", "欠薪是否由分包单位造成");
    } else if (provisionId === "mwpr-36") {
      if (facts.recruiter_type === "包工头") {
        supporting.push("你描述由个人包工头直接招用，需核实是否属于发包/分包给个人的情形。");
        applicability = "可能涉及，需核实发包链条";
      }
      pending.push("工程由谁发包", "包工头是否具备合法经营资格", "总包或建设单位是否知情");
    } else if (provisionId === "mwpr-28") {
      if (facts.has_contract === "no") {
        supporting.push("你表示没有签订书面合同，可能涉及实名制和劳动合同落实情况。");
      }
      pending.push("需要核实是否进行过实名登记、是否有门禁或用工平台记录。");
      applicability = "与合同和实名制情况相关";
    } else if (provisionId === "lcl-82") {
      supporting.push("你表示未签书面合同，或合同情况尚不清楚。");
      pending.push("需先确认你与谁构成劳动关系，以及未签合同是否超过一个月不满一年。");
      applicability = "需先确认劳动关系性质";
    } else if (provisionId === "lsr-26") {
      supporting.push("如劳动保障行政部门认定欠薪并责令支付，逾期不支付可能涉及加付赔偿金。");
      pending.push("尚未经劳动保障行政部门责令支付，赔偿金条件尚未形成。");
      applicability = "程序性规则，需先完成投诉处理";
    } else if (provisionId === "ldal-27") {
      supporting.push("如考虑劳动仲裁，需要核对仲裁时效。");
      pending.push("需确认劳动关系是否终止及终止时间；拖欠劳动报酬在关系存续期间有特别规则。");
      applicability = "适用于考虑仲裁途径时";
    } else if (provisionId === "lal-31") {
      supporting.push("你请求支付劳动报酬，可向法律援助机构咨询是否符合援助条件。");
      applicability = "如符合经济困难等条件可申请";
    } else if (provisionId === "mwpr-24") {
      supporting.push("工程款和人工费用拨付情况可能影响工资支付，可向主管部门反映核查。");
      applicability = "背景规则，需核实工程款支付情况";
    } else if (provisionId === "mwpr-31") {
      supporting.push("如项目实行总包代发工资，可通过工资专用账户和工资表核实付款情况。");
      applicability = "与工资支付链条相关";
    } else if (provisionId === "lsr-20") {
      supporting.push("需要注意劳动保障监察2年查处时效。");
      pending.push("需确认违法行为发生或终了的时间。");
      applicability = "时效风险提示";
    } else if (provisionId === "hnlsr-15") {
      supporting.push("如向河南项目所在地劳动保障监察机构投诉，监察机构应在七日内决定是否立案并通知你。");
      pending.push("需确认投诉已提交并被接收；是否立案由监察机构依法决定。");
      applicability = "仅适用于河南省内的监察投诉程序";
    } else if (provisionId === "hnlsr-16") {
      supporting.push("河南省内监察查处一般自立案之日起三十日内结案，复杂案件经批准最多延长三十日。");
      pending.push("需确认是否已立案及立案时间。");
      applicability = "仅适用于河南省内的监察办案时限";
    } else if (provisionId === "hnlsr-21") {
      supporting.push("河南省内克扣、无故拖欠工资等情形，劳动保障行政部门可责令限期支付，并可责令加付一至五倍赔偿金。");
      pending.push("赔偿金需经劳动保障行政部门责令支付等行政程序，不是投诉时自动获得。");
      applicability = "仅适用于河南省内，需先经行政处理程序";
    } else if (provisionId === "hnzh-16") {
      if (facts.recruiter_type === "包工头" || facts.subcontractor_name) {
        supporting.push("你描述由包工头或劳务方招用，河南省内总包单位对农民工工资支付负总责，推行委托总包代发。");
      }
      pending.push("需核实项目总包单位和分包关系。");
      applicability = "仅适用于河南省工程建设领域";
    } else if (provisionId === "hnzh-13") {
      supporting.push("河南省内建设单位应按约定向总包专用账户拨付人工费用，周期不得超过1个月；未按约定拨付的纳入欠薪预警。");
      pending.push("需核实项目人工费用拨付情况，可向监管部门反映核查。");
      applicability = "仅适用于河南省工程建设领域";
    } else if (provisionId === "hnbzj-26") {
      supporting.push("河南省内工程拖欠工资，经责令限期清偿或先行清偿而总包到期拒不履行的，可动用工资保证金或保函直接支付。");
      pending.push("需先经人社部门责令清偿程序，且总包到期拒不履行；保证金是否存储需核实。");
      applicability = "仅适用于河南省工程建设领域，需满足行政处理前置条件";
    }

    const document = provision.document as Record<string, unknown>;
    items.push({
      id: provisionId,
      article: provision.article,
      heading: provision.heading,
      text: provision.text,
      document_title: document.title,
      document_number: document.doc_number,
      issuing_authority: document.issuing_authority,
      official_url: document.official_url,
      official_source_name: document.official_source_name,
      verification_status: provision.verification_status,
      verification_label: provision.verification_label,
      source_note: document.source_note,
      conditions: provision.conditions,
      supporting_facts: supporting,
      pending_verification: pending,
      applicability,
      why_relevant: provision.why_relevant ?? "",
    });
  }
  return items;
}

function jurisdiction(facts: Facts): Record<string, unknown> {
  const city = facts.location_city;
  const district = facts.location_district;
  let confidence: string;
  let guidance: string;
  if (city && district) {
    confidence = "high";
    guidance = `可先向${city}${district}项目所在地的人力资源社会保障部门劳动保障监察机构咨询投诉，并通过12333确认具体受理窗口和材料清单。`;
  } else if (city) {
    confidence = "medium";
    guidance = `已确认在${city}，但区县未确认。建议拨打12333或12345，说明工地位置，确认对应的劳动保障监察机构。`;
  } else {
    confidence = "low";
    guidance = "工作城市尚未确认，暂时无法判断具体管辖。请先补充项目所在城市和区县，或拨打12333咨询。";
  }
  return {
    province: facts.location_province || null,
    city: city ?? null,
    district: district ?? null,
    primary_agency: "项目所在地人力资源社会保障部门劳动保障监察机构",
    confidence,
    guidance,
    note: "维权机构应根据用工所在地或项目所在地的管辖规则匹配，并非每个区县都有独立受理机构，具体以当地人社部门告知为准。",
  };
}

function summary(facts: Facts): string {
  const period = workPeriodText(facts);
  const parts = [
    locationText(facts),
    `从事${facts.work_type || "建筑工作"}`,
    period !== "待核实" ? `工作时间${period}` : "工作时间待核实",
    facts.owed_amount !== null && facts.owed_amount !== undefined
      ? `目前陈述尚欠${formatAmount(facts.owed_amount, Boolean(facts.owed_amount_approx))}`
      : "欠薪金额待核实",
  ];
  return parts.join("；") + "。";
}

export function runCaseAnalysis(caseRow: CaseRow, retriever: LegalRetriever): Record<string, unknown> {
  const facts = caseRow.facts;
  const legal = runLegalResearch(caseRow, retriever);
  const evidence = analyzeEvidence(facts);
  const progress = requiredProgress(facts, caseRow.intake ?? {});
  const relationship = buildRelationship(facts);
  const provisions = legal.provisions as Array<Record<string, unknown>>;
  return {
    case_id: caseRow.id,
    title: caseRow.title,
    status: caseRow.status,
    is_demo: caseRow.is_demo,
    completeness: progress,
    basic_info: basicInfo(facts),
    relationship,
    evidence,
    rights: rights(facts),
    legal_analysis: legalAnalysis(facts, provisions),
    legal_sources: {
      documents: legal.documents,
      verification_summary: legal.verification_summary,
      disclaimer: legal.disclaimer,
    },
    risk_flags: riskFlags(facts),
    jurisdiction: jurisdiction(facts),
    summary: summary(facts),
    disclaimer: "本分析仅依据你提供的信息和本地法律知识库整理，不构成正式法律意见，也不认定最终法律责任。",
    generated_at: nowIso(),
    agents: ["Intake Agent", "Legal Research Agent", "Case Analysis Agent"],
  };
}