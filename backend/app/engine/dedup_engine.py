import re
import logging
from typing import List, Dict, Any, Tuple, Set, Optional
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

def safe_str(val: Any) -> str:
    """
    Safely converts any input value to a clean string.
    Handles None, lists, dicts, numbers, etc.
    """
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
    """
    Extracts a 4-digit year without throwing ValueError.
    Handles strings like '2024-05-12', 'N/A', None, or integers.
    """
    if val is None:
        return default
    if isinstance(val, int) and 1900 <= val <= 2100:
        return val
    try:
        s = safe_str(val)
        m = re.search(r'\b(19\d\d|20\d\d)\b', s)
        if m:
            return int(m.group(1))
        # Fallback to direct integer conversion if possible
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
    def title_similarity(t1: Any, t2: Any) -> float:
        norm1 = DeduplicationEngine.normalize_title(t1)
        norm2 = DeduplicationEngine.normalize_title(t2)
        if not norm1 or not norm2:
            return 0.0
        if norm1 == norm2:
            return 1.0
        return SequenceMatcher(None, norm1, norm2).ratio()

    @staticmethod
    def extract_author_set(author_val: Any) -> Set[str]:
        """
        Normalizes author data into a clean set of author identifiers.
        Handles string, list of strings, list of dicts ({'name': '...'}), or None.
        """
        author_set = set()
        if not author_val:
            return author_set

        # If list of author objects or strings
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

        # Split by comma or 'and'
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
    def check_author_overlap(cls, authors_a: Any, authors_b: Any) -> Tuple[int, Set[str]]:
        """
        Calculates author set intersection safely and returns (overlap_count, common_authors).
        """
        try:
            set_a = cls.extract_author_set(authors_a)
            set_b = cls.extract_author_set(authors_b)
            meaningful_a = {a for a in set_a if len(a) >= 4}
            meaningful_b = {b for b in set_b if len(b) >= 4}
            common = meaningful_a.intersection(meaningful_b)
            return len(common), common
        except Exception:
            return 0, set()

    @classmethod
    def flag_corpus_duplicates(cls, papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Scans all papers in corpus and flags potential duplicates based on:
        1. Exact DOI match
        2. High Title Similarity (>= 0.88)
        3. Author Overlap Rule: >= 2 Common Authors AND (Title Sim >= 0.60 OR Year diff <= 1)
        """
        if not papers:
            return []

        flagged_papers = [dict(p) for p in papers]

        # Reset duplicate flags
        for p in flagged_papers:
            p["duplicate_flag"] = False
            p["duplicate_with_id"] = None
            p["duplicate_reason"] = None

        n = len(flagged_papers)
        for i in range(n):
            for j in range(i + 1, n):
                try:
                    p1 = flagged_papers[i]
                    p2 = flagged_papers[j]

                    doi1 = cls.normalize_doi(p1.get("doi"))
                    doi2 = cls.normalize_doi(p2.get("doi"))
                    t_sim = cls.title_similarity(p1.get("title"), p2.get("title"))

                    # Check 1: Exact DOI Match
                    if doi1 and doi2 and doi1 == doi2:
                        p1["duplicate_flag"] = True
                        p1["duplicate_with_id"] = p2.get("id")
                        p1["duplicate_reason"] = f"Identical DOI ({doi1}) with {p2.get('id')}"

                        p2["duplicate_flag"] = True
                        p2["duplicate_with_id"] = p1.get("id")
                        p2["duplicate_reason"] = f"Identical DOI ({doi2}) with {p1.get('id')}"
                        continue

                    # Check 2: High Title Similarity (>= 0.88)
                    if t_sim >= 0.88:
                        p1["duplicate_flag"] = True
                        p1["duplicate_with_id"] = p2.get("id")
                        p1["duplicate_reason"] = f"High Title Similarity ({int(t_sim*100)}%) with {p2.get('id')}"

                        p2["duplicate_flag"] = True
                        p2["duplicate_with_id"] = p1.get("id")
                        p2["duplicate_reason"] = f"High Title Similarity ({int(t_sim*100)}%) with {p1.get('id')}"
                        continue

                    # Check 3: The >= 2 Author Overlap Rule
                    overlap_count, common_authors = cls.check_author_overlap(p1.get("authors"), p2.get("authors"))
                    y1 = safe_year(p1.get("year"))
                    y2 = safe_year(p2.get("year"))
                    year_diff = abs(y1 - y2)

                    if overlap_count >= 2:
                        if t_sim >= 0.60 or year_diff <= 1:
                            reason1 = f"Author Overlap ({overlap_count} matches: {', '.join(list(common_authors)[:2])}) with {p2.get('id')}"
                            reason2 = f"Author Overlap ({overlap_count} matches: {', '.join(list(common_authors)[:2])}) with {p1.get('id')}"
                            p1["duplicate_flag"] = True
                            p1["duplicate_with_id"] = p2.get("id")
                            p1["duplicate_reason"] = reason1

                            p2["duplicate_flag"] = True
                            p2["duplicate_with_id"] = p1.get("id")
                            p2["duplicate_reason"] = reason2

                except Exception as pair_ex:
                    logger.debug(f"Pair duplicate comparison skipped for index ({i},{j}): {pair_ex}")
                    continue

        return flagged_papers

    @classmethod
    def merge_records(cls, existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two duplicate paper records preserving the richest metadata.
        """
        merged = dict(existing)
        try:
            # Prefer non-empty abstract
            e_abs = safe_str(merged.get("abstract"))
            i_abs = safe_str(incoming.get("abstract"))
            if (not e_abs or e_abs.lower() in ["n/a", "none"]) and i_abs and i_abs.lower() not in ["n/a", "none"]:
                merged["abstract"] = incoming.get("abstract")

            # Prefer valid DOI
            e_doi = cls.normalize_doi(merged.get("doi"))
            i_doi = cls.normalize_doi(incoming.get("doi"))
            if not e_doi and i_doi:
                merged["doi"] = incoming.get("doi")

            # Prefer valid URL
            if not merged.get("url") and incoming.get("url"):
                merged["url"] = incoming.get("url")

            # Highest citation count
            c1 = int(merged.get("citations_count") or 0) if str(merged.get("citations_count", 0)).isdigit() else 0
            c2 = int(incoming.get("citations_count") or 0) if str(incoming.get("citations_count", 0)).isdigit() else 0
            merged["citations_count"] = max(c1, c2)

            # Combine sources
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
        """
        Deduplicates incoming papers against existing papers and among themselves.
        Guaranteed zero-crash execution.
        Returns: (unique_new_papers_to_add, duplicates_count)
        """
        if not new_papers:
            return [], 0

        retained = list(existing_papers or [])
        unique_new = []
        duplicates_count = 0

        for incoming in new_papers:
            try:
                incoming_doi = cls.normalize_doi(incoming.get("doi"))
                incoming_title = safe_str(incoming.get("title"))
                is_dup = False

                for i, target in enumerate(retained):
                    target_doi = cls.normalize_doi(target.get("doi"))

                    # 1. Exact DOI Match
                    if incoming_doi and target_doi and incoming_doi == target_doi:
                        is_dup = True
                        retained[i] = cls.merge_records(target, incoming)
                        duplicates_count += 1
                        break

                    # 2. Fuzzy Title Similarity
                    sim = cls.title_similarity(incoming_title, target.get("title"))
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
