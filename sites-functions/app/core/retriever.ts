import { CHANNELS, LEGAL_DOCUMENTS } from "../knowledge/data.ts";
import { mentionsHenan, type RegionScope } from "./regions.ts";
import type { ChannelPayload, LegalDocumentPayload, SerializedProvision } from "./types.ts";
import { pyRound } from "./util.ts";

const CJK_BLOCK = /[一-鿿]+/g;
const ASCII_WORD = /[a-zA-Z0-9]+/g;

const STOP_BIGRAMS = new Set([
  "的规", "规定", "劳动", "单位", "用人", "应当", "可以", "依法", "有关", "以及", "或者", "相关", "进行",
]);

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const normalized = text.toLowerCase();
  for (const block of normalized.match(CJK_BLOCK) ?? []) {
    if (block.length === 1) {
      tokens.push(block);
      continue;
    }
    for (let index = 0; index < block.length - 1; index += 1) {
      tokens.push(block.slice(index, index + 2));
    }
  }
  tokens.push(...(normalized.match(ASCII_WORD) ?? []));
  return tokens.filter((token) => !STOP_BIGRAMS.has(token));
}

interface FlatProvision {
  id: string;
  article: string;
  heading: string;
  text: string;
  topics: string[];
  conditions: string[];
  keywords: string[];
  verification_status: string;
  document: Record<string, unknown>;
  region: string;
}

function documentDefaults(payload: LegalDocumentPayload): Record<string, unknown> {
  return {
    id: payload.id,
    title: payload.title,
    doc_number: payload.doc_number ?? "待核验",
    issuing_authority: payload.issuing_authority ?? "待核验",
    region: payload.region ?? "national",
    region_name: payload.region_name ?? "全国",
    publish_date: payload.publish_date ?? null,
    effective_date: payload.effective_date ?? null,
    expiry_date: payload.expiry_date ?? null,
    validity: payload.validity ?? "待核验",
    official_url: payload.official_url ?? null,
    official_source_name: payload.official_source_name ?? null,
    last_verified_at: payload.last_verified_at ?? null,
    verification_status: payload.verification_status ?? "pending",
    source_note: payload.source_note ?? null,
  };
}

function flattenDocuments(): FlatProvision[] {
  const flat: FlatProvision[] = [];
  for (const payload of LEGAL_DOCUMENTS) {
    const document = documentDefaults(payload);
    for (const provision of payload.provisions ?? []) {
      flat.push({
        id: provision.id,
        article: provision.article ?? "",
        heading: provision.heading ?? "",
        text: provision.text,
        topics: provision.topics ?? [],
        conditions: provision.conditions ?? [],
        keywords: provision.keywords ?? [],
        verification_status: provision.verification_status ?? (document.verification_status as string),
        document,
        region: document.region as string,
      });
    }
  }
  return flat;
}

export function serializeProvision(provision: FlatProvision, score = 0): SerializedProvision {
  return {
    id: provision.id,
    article: provision.article,
    heading: provision.heading,
    text: provision.text,
    topics: provision.topics,
    conditions: provision.conditions,
    keywords: provision.keywords,
    verification_status: provision.verification_status,
    document: provision.document,
    score: pyRound(score * 10000) / 10000,
  };
}

export class LegalRetriever {
  private provisions: FlatProvision[];
  private tokenCounts: Array<Map<string, number>>;
  private idf: Map<string, number>;
  private avgLength: number;

  constructor() {
    this.provisions = flattenDocuments();
    this.tokenCounts = this.provisions.map((provision) => {
      const counts = new Map<string, number>();
      for (const token of tokenize(LegalRetriever.searchableText(provision))) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
      return counts;
    });
    const documentFrequency = new Map<string, number>();
    for (const counts of this.tokenCounts) {
      for (const token of counts.keys()) {
        documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      }
    }
    const total = Math.max(this.provisions.length, 1);
    this.idf = new Map(
      [...documentFrequency.entries()].map(([token, freq]) => [
        token,
        Math.log(1 + (total - freq + 0.5) / (freq + 0.5)),
      ]),
    );
    this.avgLength = this.provisions.length
      ? this.tokenCounts.reduce((sum, counts) => sum + [...counts.values()].reduce((a, b) => a + b, 0), 0) / total
      : 1;
  }

  private static searchableText(provision: FlatProvision): string {
    return [
      provision.heading,
      provision.text,
      provision.topics.join(" "),
      provision.conditions.join(" "),
      provision.keywords.join(" "),
      provision.document.title as string,
    ].join(" ");
  }

  private score(index: number, queryTokens: string[], rawQuery: string, region?: RegionScope | null): number {
    const provision = this.provisions[index];
    const counts = this.tokenCounts[index];
    const length = Math.max([...counts.values()].reduce((a, b) => a + b, 0), 1);
    let score = 0;
    for (const token of queryTokens) {
      const frequency = counts.get(token) ?? 0;
      if (!frequency) continue;
      const idf = this.idf.get(token) ?? 0;
      const denominator = frequency + 1.2 * (0.25 + (0.75 * length) / this.avgLength);
      score += (idf * frequency * 2.2) / denominator;
    }
    for (const keyword of provision.keywords) {
      if (keyword && rawQuery.includes(keyword)) score += 1.8;
    }
    for (const topic of provision.topics) {
      if (topic && rawQuery.includes(topic)) score += 1.2;
    }
    if (provision.region === "henan") {
      if (region === "henan") score += 0.5;
      else if (rawQuery.includes("河南") || rawQuery.includes("郑州")) score += 0.4;
    }
    if (provision.verification_status === "pending") score -= 0.2;
    return score;
  }

  search(query: string, topK = 8, minScore = 0.35, ids?: string[] | null, region?: RegionScope | null): SerializedProvision[] {
    if (!this.provisions.length) return [];
    const allowHenan = region === "henan" || (region !== "national" && mentionsHenan(query));
    const queryTokens = tokenize(query);
    const scored: Array<{ score: number; index: number }> = [];
    for (let index = 0; index < this.provisions.length; index += 1) {
      if (ids && !ids.includes(this.provisions[index].id)) continue;
      if (!allowHenan && this.provisions[index].region !== "national") continue;
      scored.push({ score: this.score(index, queryTokens, query, region), index });
    }
    scored.sort((a, b) => b.score - a.score || b.index - a.index);
    const results: SerializedProvision[] = [];
    for (const { score, index } of scored) {
      if (score < minScore && !ids) continue;
      results.push(serializeProvision(this.provisions[index], score));
      if (results.length >= topK) break;
    }
    return results;
  }

  getMany(ids: string[]): SerializedProvision[] {
    const byId = new Map(this.provisions.map((provision, index) => [provision.id, index]));
    const results: SerializedProvision[] = [];
    for (const id of ids) {
      const index = byId.get(id);
      if (index !== undefined) results.push(serializeProvision(this.provisions[index], 1));
    }
    return results;
  }

  allDocuments(): Array<Record<string, unknown>> {
    return LEGAL_DOCUMENTS.map((payload) => {
      const document = documentDefaults(payload);
      return {
        id: document.id,
        title: document.title,
        doc_number: document.doc_number,
        issuing_authority: document.issuing_authority,
        region_name: document.region_name,
        validity: document.validity,
        verification_status: document.verification_status,
        official_url: document.official_url,
        official_source_name: document.official_source_name,
        last_verified_at: document.last_verified_at,
        source_note: document.source_note,
        provision_count: (payload.provisions ?? []).length,
      };
    });
  }
}

export function sortedChannels(): ChannelPayload[] {
  return [...CHANNELS]
    .map((channel) => ({
      ...channel,
      scope: channel.scope ?? "national",
      priority: channel.priority ?? 99,
      verification_status: channel.verification_status ?? "pending",
      legal_basis: channel.legal_basis ?? [],
    }))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}