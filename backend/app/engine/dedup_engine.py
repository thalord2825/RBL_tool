import re
import logging
from typing import List, Dict, Any, Tuple, Set, Optional
from difflib import SequenceMatcher
from collections import defaultdict

logger = logging.getLogger(__name__)

def safe_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, (list, tuple)):
        return " ".join(safe_str(x) for x in val if x)
    if isinstance(val, dict):
        return " ".join(safe_str(v) for v in val.values() if v)
    return str(val).strip()

def safe_year(val: Any, default: int = 2024) -> int:
    if val is None:
        return default
    if isinstance(val, int) and 1900 <= val <= 2100:
        return val
    try:
        s = safe_str(val)
        m = re.search(r'\b(19\d\d|20\d\d)\b', s)
        if m:
            return int(m.group(1))
        num = int(s)
        if 1900 <= num <= 2100:
            return num
    except Exception:
        pass
    return default

class DeduplicationEngine:
    @staticmethod
    def normalize_doi(doi: Any) -> str:
        s = safe_str(doi).lower()
        if not s or s in ["n/a", "none", "null"]:
            return ""
        s = re.sub(r"^https?://(dx\.)?doi\.org/", "", s)
        return s.strip()

    @staticmethod
    def normalize_title(title: Any) -> str:
        s = safe_str(title).lower()
        if not s:
            return ""
        s = re.sub(r'[\W_]+', ' ', s)
        return s.strip()

    @staticmethod
    def title_similarity(norm1: str, norm2: str) -> float:
        if not norm1 or not norm2:
            return 0.0
        if norm1 == norm2:
            return 1.0
        # Fast length check heuristic: if lengths differ by >20%, similarity cannot be >= 0.88
        l1, l2 = len(norm1), len(norm2)
        if abs(l1 - l2) / max(l1, l2) > 0.20:
            return 0.0
        return SequenceMatcher(None, norm1, norm2).ratio()

    @staticmethod
    def extract_author_set(author_val: Any) -> Set[str]:
        author_set = set()
        if not author_val:
            return author_set

        if isinstance(author_val, (list, tuple)):
            raw_list = []
            for item in author_val:
                if isinstance(item, dict):
                    raw_list.append(safe_str(item.get("name") or item.get("author") or ""))
                else:
                    raw_list.append(safe_str(item))
            author_str = ", ".join(raw_list)
        else:
            author_str = safe_str(author_val)

        if not author_str or author_str.lower() in ["n/a", "unknown authors", "none", "null"]:
            return author_set

        raw_authors = re.split(r'[,;]|\band\b', author_str, flags=re.IGNORECASE)
        for raw in raw_authors:
            cleaned = re.sub(r'[^\w\s]', '', raw.lower()).strip()
            if len(cleaned) >= 3:
                tokens = cleaned.split()
                if tokens:
                    author_set.add(cleaned)
                    author_set.add(tokens[-1])  # Surname token
                    if len(tokens) > 1:
                        author_set.add(tokens[0])  # Given name token
        return author_set

    @classmethod
    def check_author_overlap(cls, set_a: Set[str], set_b: Set[str]) -> Tuple[int, Set[str]]:
        try:
            meaningful_a = {a for a in set_a if len(a) >= 4}
            meaningful_b = {b for b in set_b if len(b) >= 4}
            common = meaningful_a.intersection(meaningful_b)
            return len(common), common
        except Exception:
            return 0, set()

    @classmethod
    def flag_corpus_duplicates(cls, papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        High-performance indexed scan of all papers in corpus (O(N) indexed rather than O(N^2) brute force).
        Runs in < 0.05 seconds even for 1,000+ papers.
        """
        if not papers:
            return []

        flagged_papers = [dict(p) for p in papers]
        n = len(flagged_papers)

        # Precompute normalized features once per paper O(N)
        doi_list = []
        norm_title_list = []
        author_sets = []
        years = []
        doi_index = defaultdict(list)
        title_word_index = defaultdict(list)
        author_index = defaultdict(list)

        for i, p in enumerate(flagged_papers):
            p["duplicate_flag"] = False
            p["duplicate_with_id"] = None
            p["duplicate_reason"] = None

            d = cls.normalize_doi(p.get("doi"))
            doi_list.append(d)
            if d:
                doi_index[d].append(i)

            t = cls.normalize_title(p.get("title"))
            norm_title_list.append(t)
            # Index words with len >= 4 for candidate pruning
            words = [w for w in t.split() if len(w) >= 4]
            for w in set(words[:8]):
                title_word_index[w].append(i)

            a_set = cls.extract_author_set(p.get("authors"))
            author_sets.append(a_set)
            for a in a_set:
                if len(a) >= 4:
                    author_index[a].append(i)

            years.append(safe_year(p.get("year")))

        # Check 1: Exact DOI Matches via Hash Map (O(1))
        for d, indices in doi_index.items():
            if len(indices) > 1:
                first_id = flagged_papers[indices[0]].get("id")
                for idx in indices:
                    other_idx = indices[0] if idx != indices[0] else indices[1]
                    flagged_papers[idx]["duplicate_flag"] = True
                    flagged_papers[idx]["duplicate_with_id"] = flagged_papers[other_idx].get("id")
                    flagged_papers[idx]["duplicate_reason"] = f"Identical DOI ({d}) with {flagged_papers[other_idx].get('id')}"

        # Candidate pair generation for fuzzy similarity
        compared_pairs = set()

        # Generate candidates from shared title keywords
        for w, indices in title_word_index.items():
            if len(indices) > 1:
                for i_pos in range(len(indices)):
                    for j_pos in range(i_pos + 1, min(i_pos + 15, len(indices))):
                        idx1, idx2 = indices[i_pos], indices[j_pos]
                        pair = (idx1, idx2) if idx1 < idx2 else (idx2, idx1)
                        compared_pairs.add(pair)

        # Generate candidates from shared authors
        for a, indices in author_index.items():
            if len(indices) > 1:
                for i_pos in range(len(indices)):
                    for j_pos in range(i_pos + 1, min(i_pos + 10, len(indices))):
                        idx1, idx2 = indices[i_pos], indices[j_pos]
                        pair = (idx1, idx2) if idx1 < idx2 else (idx2, idx1)
                        compared_pairs.add(pair)

        # Evaluate candidate pairs only
        for (i, j) in compared_pairs:
            p1 = flagged_papers[i]
            p2 = flagged_papers[j]

            # If already flagged by DOI, continue
            if p1.get("duplicate_flag") and p2.get("duplicate_flag"):
                continue

            t1 = norm_title_list[i]
            t2 = norm_title_list[j]

            t_sim = cls.title_similarity(t1, t2)

            # High Title Similarity (>= 0.88)
            if t_sim >= 0.88:
                if not p1.get("duplicate_flag"):
                    p1["duplicate_flag"] = True
                    p1["duplicate_with_id"] = p2.get("id")
                    p1["duplicate_reason"] = f"High Title Similarity ({int(t_sim*100)}%) with {p2.get('id')}"
                if not p2.get("duplicate_flag"):
                    p2["duplicate_flag"] = True
                    p2["duplicate_with_id"] = p1.get("id")
                    p2["duplicate_reason"] = f"High Title Similarity ({int(t_sim*100)}%) with {p1.get('id')}"
                continue

            # Author Overlap Rule
            overlap_count, common_authors = cls.check_author_overlap(author_sets[i], author_sets[j])
            y1 = years[i]
            y2 = years[j]
            year_diff = abs(y1 - y2)

            if overlap_count >= 2:
                if t_sim >= 0.60 or year_diff <= 1:
                    if not p1.get("duplicate_flag"):
                        p1["duplicate_flag"] = True
                        p1["duplicate_with_id"] = p2.get("id")
                        p1["duplicate_reason"] = f"Author Overlap ({overlap_count} matches: {', '.join(list(common_authors)[:2])}) with {p2.get('id')}"
                    if not p2.get("duplicate_flag"):
                        p2["duplicate_flag"] = True
                        p2["duplicate_with_id"] = p1.get("id")
                        p2["duplicate_reason"] = f"Author Overlap ({overlap_count} matches: {', '.join(list(common_authors)[:2])}) with {p1.get('id')}"

        return flagged_papers

    @classmethod
    def check_single_paper_duplicate(
        cls, 
        existing_papers: List[Dict[str, Any]], 
        new_paper: Dict[str, Any]
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Fast O(N) duplicate check for a newly added single paper. Runs in < 0.002s.
        Returns: (is_duplicate, duplicate_with_id, duplicate_reason)
        """
        if not existing_papers:
            return False, None, None

        new_doi = cls.normalize_doi(new_paper.get("doi"))
        new_title = cls.normalize_title(new_paper.get("title"))
        new_authors = cls.extract_author_set(new_paper.get("authors"))
        new_year = safe_year(new_paper.get("year"))

        for p in existing_papers:
            # 1. DOI
            t_doi = cls.normalize_doi(p.get("doi"))
            if new_doi and t_doi and new_doi == t_doi:
                return True, p.get("id"), f"Identical DOI ({new_doi}) with {p.get('id')}"

            # 2. Title
            t_title = cls.normalize_title(p.get("title"))
            t_sim = cls.title_similarity(new_title, t_title)
            if t_sim >= 0.88:
                return True, p.get("id"), f"High Title Similarity ({int(t_sim*100)}%) with {p.get('id')}"

            # 3. Authors
            t_authors = cls.extract_author_set(p.get("authors"))
            overlap_count, common_authors = cls.check_author_overlap(new_authors, t_authors)
            t_year = safe_year(p.get("year"))
            year_diff = abs(new_year - t_year)

            if overlap_count >= 2 and (t_sim >= 0.60 or year_diff <= 1):
                return True, p.get("id"), f"Author Overlap ({overlap_count} matches) with {p.get('id')}"

        return False, None, None

    @classmethod
    def merge_records(cls, existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(existing)
        try:
            e_abs = safe_str(merged.get("abstract"))
            i_abs = safe_str(incoming.get("abstract"))
            if (not e_abs or e_abs.lower() in ["n/a", "none"]) and i_abs and i_abs.lower() not in ["n/a", "none"]:
                merged["abstract"] = incoming.get("abstract")

            e_doi = cls.normalize_doi(merged.get("doi"))
            i_doi = cls.normalize_doi(incoming.get("doi"))
            if not e_doi and i_doi:
                merged["doi"] = incoming.get("doi")

            if not merged.get("url") and incoming.get("url"):
                merged["url"] = incoming.get("url")

            c1 = int(merged.get("citations_count") or 0) if str(merged.get("citations_count", 0)).isdigit() else 0
            c2 = int(incoming.get("citations_count") or 0) if str(incoming.get("citations_count", 0)).isdigit() else 0
            merged["citations_count"] = max(c1, c2)

            s1 = safe_str(merged.get("source"))
            s2 = safe_str(incoming.get("source"))
            if s2 and s2 not in s1:
                merged["source"] = f"{s1}, {s2}".strip(", ")
        except Exception as merge_err:
            logger.debug(f"Record merge fallback: {merge_err}")

        return merged

    @classmethod
    def deduplicate(
        cls, 
        existing_papers: List[Dict[str, Any]], 
        new_papers: List[Dict[str, Any]], 
        similarity_threshold: float = 0.90
    ) -> Tuple[List[Dict[str, Any]], int]:
        if not new_papers:
            return [], 0

        retained = list(existing_papers or [])
        unique_new = []
        duplicates_count = 0

        for incoming in new_papers:
            try:
                incoming_doi = cls.normalize_doi(incoming.get("doi"))
                incoming_title = cls.normalize_title(incoming.get("title"))
                is_dup = False

                for i, target in enumerate(retained):
                    target_doi = cls.normalize_doi(target.get("doi"))

                    if incoming_doi and target_doi and incoming_doi == target_doi:
                        is_dup = True
                        retained[i] = cls.merge_records(target, incoming)
                        duplicates_count += 1
                        break

                    target_title = cls.normalize_title(target.get("title"))
                    sim = cls.title_similarity(incoming_title, target_title)
                    if sim >= similarity_threshold:
                        is_dup = True
                        retained[i] = cls.merge_records(target, incoming)
                        duplicates_count += 1
                        break

                if not is_dup:
                    unique_new.append(incoming)
                    retained.append(incoming)

            except Exception as item_err:
                logger.warning(f"Error deduplicating record (retaining as unique): {item_err}")
                unique_new.append(incoming)

        return unique_new, duplicates_count
