# 河南欠薪知识资料导入记录（2026-11-23）

来源资料包：`工友权益助手-数据库随身版-20261123.zip`，内含 SQLite `wr-db-portable/wr-db/data/workerrights.db`。
本次只读 ZIP 与数据库，按字段白名单导出公开知识，不迁移任何业务数据。

## 导入范围与排除项

只从 `kb_documents` 提取公开法律条文与官方渠道。

- 导入：`kb_law_henan`（河南地方条文）、`kb_channel`（官方渠道）、`kb_law` 中可补充的国家条文。
- 排除：`cases`、`conversations`、`messages`、`facts`、`payments`、`promises`、`ask_log`、`audit_log`、`app_settings`、`exports`、`case_analyses`、`case_citations`、`evidence`、`form_submissions`、`sessions`、`steps`、`runs` 等业务表。
- 排除：`kb_embeddings`、`kb_chunks`、`kb_chunks_fts*`、`kb_chunk_terms`、`kb_queries` 等向量与索引表。
- 排除：`kb_guide`（3 条 draft）、`kb_template`（1 条 draft）。
- `answers` 表 13 条已审定问答本次不加入生产知识库，留作后续测试参考。

## 河南地方条文（99 条，3 个来源）

| 文件 | 文号 | 条数 | 官方来源 | 核验 |
| --- | --- | --- | --- | --- |
| `knowledge/henan/labor-supervision-regulation.json` | 河南省人大常委会公告第56号（2010年修正） | 28 | 国家法律法规数据库 flk.npc.gov.cn | 已逐条核验 |
| `knowledge/henan/wage-deposit-measures.json` | 豫人社规〔2022〕4号 | 37 | 河南省人社厅 hrss.henan.gov.cn/2024/01-19/2889438.html | 已逐条核验 |
| `knowledge/henan/wage-account-rules.json` | 豫人社规〔2022〕1号 | 34 | 河南省人社厅 hrss.henan.gov.cn/2024/01-19/2889436.html | 已逐条核验 |

条文 ID 规则：`hnlsr-N`（监察条例）、`hnbzj-N`（保证金办法）、`hnzh-N`（专用账户细则），N 为条号，稳定不变。

核验方式：把资料包正文与官方原文逐条做归一化比对。99 条中 98 条与官方原文完全一致；1 条不一致已按官方原文更正：

- `hnlsr-20`（监察条例第二十条）：资料包为 2010 年修正前旧文本（未签合同罚款条款），官方修正后文本为“用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资”。已采用官方修正文本。

随身版 `status=ready` 不等于网站 `verified`。本次三条来源均取得官方原文并逐条核对后才标记 `verified`，`last_verified_at=2026-11-23`。监察条例公告文号沿用资料包条目、未单独核验，已在 `source_note` 注明。保证金办法资料包标注“等8部门”与官方通知落款部门数不一致，已按官方落款表述为多部门。

每条河南条文 `conditions` 首项为地理适用条件（河南省行政区域/工程建设领域），检索与引用时随条文返回，避免外省案件误用。

## 国家条文补充与更正

资料包 `kb_law` 11 条中，7 条与现有知识库重复（`mwpr-16/30/31/36`、`lcl-85`、`ldal-27`、`lsr-20`），保留现有引用 ID。新增 4 条并按中国政府网公布全文核验：`mwpr-3`、`mwpr-6`、`mwpr-7`、`mwpr-42`。

更正一处条号错位：原 `mwpr-16` 正文实为条例第十二条文本。已按官方原文把 `mwpr-16` 更正为第十六条（拖欠工资应当依法清偿），并补录 `mwpr-12`（按约定周期足额支付工资）。`mwpr-30/31/36` 与官方全文一致，升级为 `verified`；`mwpr-24/28` 为节选，保持 `transcribed`。

## 官方渠道（去重后 8 个，无重复入口）

资料包 `kb_channel` 5 条全部映射到现有渠道 ID，不新增重复入口：

- `national-root-wage-platform`：补充微信公众号入口路径（待核验当前页面结构）。
- `henan-12333`、`legal-aid-12348`：沿用，补充免经济困难核查口径提示。
- `henan-housing-authority`：升级为 `verified`，官方链接改为河南省建筑市场监管公共服务平台欠薪专栏投诉举报电话页（2026-11-23 在线核验），职责表述改为“协助人社部门督办房建市政工程领域欠薪”。
- 河南监察投诉举报电话汇总页：资料包提供的省厅链接经访问为 404（死链），不采用；在 `local-labor-supervision` 的 `source_note` 注明，引导通过 12333 或省厅官网查询。全省入口不写成具体区县受理点。

## 地域适配与知识版本

- 检索器新增 `region` 参数（`henan`/`national`/自动）。地方条文以工地所在地为准：河南事实返回全国+河南条文；已知外省只返回全国条文；地点未知默认全国，查询词明确提及河南时才返回河南条文并附适用条件。
- QCA `search_law` 与案件法律依据、案件分析均按案件事实推断地域，引用 ID 在咨询回复与分析中一致。
- `sync-knowledge.mjs` 从 `knowledge/` 源文件重新生成 `app/knowledge/data.ts`，并输出 `KNOWLEDGE_VERSION`（源文件内容哈希）。
- 派生结果（分析/行动/表单）缓存加入 `knowledge_version` 判断：知识升级后，即使用户未修改案情，下次读取也会用新版资料重新生成；行动步骤勾选状态按 `step_key` 保留。

## 统计

- 河南条文：新增 99，复用 0，待核验 0（全部已核验，其中 1 条按官方原文更正）。
- 国家条文：新增 5（`mwpr-3/6/7/12/42`），复用 7，更正 1（`mwpr-16`），升级核验 3（`mwpr-30/31/36`）。
- 官方渠道：复用更新 5，死链弃用 1，新增 0；渠道总数维持 8。
- 知识库文件总数：12（国家 5 + 河南条文 3 + 河南待核验指引 4）。