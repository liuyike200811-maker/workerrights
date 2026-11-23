import math
import re
from collections import Counter

from sqlalchemy.orm import Session

from backend.legal.loader import load_regions
from backend.models.legal import LegalDocument, LegalProvision

CJK_BLOCK = re.compile(r"[\u4e00-\u9fff]+")
ASCII_WORD = re.compile(r"[a-zA-Z0-9]+")

STOP_BIGRAMS = {
    "的规",
    "规定",
    "劳动",
    "单位",
    "用人",
    "应当",
    "可以",
    "依法",
    "有关",
    "以及",
    "或者",
    "相关",
    "进行",
}


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    normalized = text.lower()
    for block in CJK_BLOCK.findall(normalized):
        if len(block) == 1:
            tokens.append(block)
            continue
        tokens.extend(block[index : index + 2] for index in range(len(block) - 1))
    tokens.extend(ASCII_WORD.findall(normalized))
    return [token for token in tokens if token not in STOP_BIGRAMS]


def _henan_hints() -> list[str]:
    hints = ["河南"]
    for city in load_regions()["cities"]:
        hints.append(city["name"])
        short = city["name"].removesuffix("市")
        if short and short != city["name"]:
            hints.append(short)
    return hints


HENAN_HINTS = _henan_hints()


def mentions_henan(text: str) -> bool:
    return any(hint in text for hint in HENAN_HINTS)


def case_region_scope(facts: dict) -> str | None:
    """Local provisions follow the worksite location (Henan / national / unknown)."""
    province = facts.get("location_province")
    city = facts.get("location_city")
    if (province and "河南" in province) or (city and city in HENAN_HINTS):
        return "henan"
    if province or city:
        return "national"
    return None


def _provision_document(provision: LegalProvision) -> dict:
    document: LegalDocument = provision.document
    return {
        "id": document.id,
        "title": document.title,
        "doc_number": document.doc_number,
        "issuing_authority": document.issuing_authority,
        "region": document.region,
        "region_name": document.region_name,
        "publish_date": document.publish_date,
        "effective_date": document.effective_date,
        "expiry_date": document.expiry_date,
        "validity": document.validity,
        "official_url": document.official_url,
        "official_source_name": document.official_source_name,
        "last_verified_at": document.last_verified_at,
        "verification_status": document.verification_status,
        "source_note": document.source_note,
    }


def serialize_provision(provision: LegalProvision, score: float = 0.0) -> dict:
    return {
        "id": provision.id,
        "article": provision.article,
        "heading": provision.heading,
        "text": provision.text,
        "topics": provision.topics,
        "conditions": provision.conditions,
        "keywords": provision.keywords,
        "verification_status": provision.verification_status,
        "document": _provision_document(provision),
        "score": round(score, 4),
    }


class LegalRetriever:
    """Local lexical retriever (Chinese character bigrams + BM25-style scoring).

    This is the default offline retriever. ``backend/database/vector_store.py``
    documents the PostgreSQL + pgvector upgrade path; the interface is kept small
    so an embedding retriever can replace it without touching agents.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.provisions = db.query(LegalProvision).all()
        self._token_counts = [
            Counter(tokenize(self._searchable_text(provision))) for provision in self.provisions
        ]
        document_frequency: Counter[str] = Counter()
        for counts in self._token_counts:
            document_frequency.update(counts.keys())
        total = max(len(self.provisions), 1)
        self._idf = {
            token: math.log(1 + (total - freq + 0.5) / (freq + 0.5))
            for token, freq in document_frequency.items()
        }
        self._avg_length = (
            sum(sum(counts.values()) for counts in self._token_counts) / total if self.provisions else 1
        )

    @staticmethod
    def _searchable_text(provision: LegalProvision) -> str:
        return " ".join(
            [
                provision.heading,
                provision.text,
                " ".join(provision.topics or []),
                " ".join(provision.conditions or []),
                " ".join(provision.keywords or []),
                provision.document.title,
            ]
        )

    def _score(self, index: int, query_tokens: list[str], raw_query: str, region: str | None = None) -> float:
        provision = self.provisions[index]
        counts = self._token_counts[index]
        length = max(sum(counts.values()), 1)
        score = 0.0
        for token in query_tokens:
            frequency = counts.get(token, 0)
            if not frequency:
                continue
            idf = self._idf.get(token, 0.0)
            denominator = frequency + 1.2 * (0.25 + 0.75 * length / self._avg_length)
            score += idf * frequency * 2.2 / denominator
        for keyword in provision.keywords or []:
            if keyword and keyword in raw_query:
                score += 1.8
        for topic in provision.topics or []:
            if topic and topic in raw_query:
                score += 1.2
        if provision.document.region == "henan":
            if region == "henan":
                score += 0.5
            elif "河南" in raw_query or "郑州" in raw_query:
                score += 0.4
        if provision.verification_status == "pending":
            score -= 0.2
        return score

    def search(
        self,
        query: str,
        top_k: int = 8,
        min_score: float = 0.35,
        ids: list[str] | None = None,
        region: str | None = None,
    ) -> list[dict]:
        if not self.provisions:
            return []
        allow_henan = region == "henan" or (region != "national" and mentions_henan(query))
        query_tokens = tokenize(query)
        scored: list[tuple[float, int]] = []
        for index, provision in enumerate(self.provisions):
            if ids and provision.id not in ids:
                continue
            if not allow_henan and provision.document.region != "national":
                continue
            score = self._score(index, query_tokens, query, region)
            scored.append((score, index))
        scored.sort(reverse=True)
        results: list[dict] = []
        for score, index in scored:
            if score < min_score and not ids:
                continue
            results.append(serialize_provision(self.provisions[index], score))
            if len(results) >= top_k:
                break
        return results

    def get_many(self, ids: list[str]) -> list[dict]:
        index_by_id = {provision.id: index for index, provision in enumerate(self.provisions)}
        results: list[dict] = []
        for provision_id in ids:
            index = index_by_id.get(provision_id)
            if index is not None:
                results.append(serialize_provision(self.provisions[index], 1.0))
        return results

    def all_documents(self) -> list[dict]:
        documents = self.db.query(LegalDocument).all()
        return [
            {
                "id": document.id,
                "title": document.title,
                "doc_number": document.doc_number,
                "issuing_authority": document.issuing_authority,
                "region_name": document.region_name,
                "validity": document.validity,
                "verification_status": document.verification_status,
                "official_url": document.official_url,
                "official_source_name": document.official_source_name,
                "last_verified_at": document.last_verified_at,
                "source_note": document.source_note,
                "provision_count": len(document.provisions),
            }
            for document in documents
        ]
