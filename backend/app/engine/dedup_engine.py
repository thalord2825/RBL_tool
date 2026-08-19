import re
from typing import List, Dict, Any, Tuple, Set, Optional
from difflib import SequenceMatcher

class DeduplicationEngine:
    @staticmethod
    def normalize_doi(doi: str) -> str:
        if not doi or doi == "N/A":
            return ""
        d = doi.lower().strip()
        d = re.sub(r"^https?://(dx\.)?doi\.org/", "", d)
        return d.strip()

    @staticmethod
    def normalize_title(title: str) -> str:
        if not title:
            return ""
        t = title.lower()
        t = re.sub(r'[\W_]+', ' ', t)
        return t.strip()

    @staticmethod
    def title_similarity(t1: str, t2: str) -> float:
        norm1 = DeduplicationEngine.normalize_title(t1)
        norm2 = DeduplicationEngine.normalize_title(t2)
        if not norm1 or not norm2:
            return 0.0
        if norm1 == norm2:
            return 1.0
        return SequenceMatcher(None, norm1, norm2).ratio()

    @staticmethod
    def extract_author_set(author_str: str) -> Set[str]:
        """
        Normalizes author strings into a clean set of author name identifiers (last names or full tokens).
        Handles comma-separated, 'and' separated, and various bibliographic formats.
        """
        if not author_str or author_str in ["N/A", "Unknown Authors"]:
            return set()
        
        # Split by comma or 'and'
        raw_authors = re.split(r'[,;]|\band\b', author_str, flags=re.IGNORECASE)
        author_set = set()
        for raw in raw_authors:
            cleaned = re.sub(r'[^\w\s]', '', raw.lower()).strip()
            if len(cleaned) >= 3:
                # Store full normalized name and last name token
                tokens = cleaned.split()
                if tokens:
                    # Last name is usually the last token (or first in Vietnamese 'Nguyen Dat Quoc')
                    author_set.add(cleaned)
                    author_set.add(tokens[-1])
                    if len(tokens) > 1:
                        author_set.add(tokens[0]) # Add surname for Vietnamese naming convention
        return author_set

    @classmethod
    def check_author_overlap(cls, authors_a: str, authors_b: str) -> Tuple[int, Set[str]]:
        """
        Calculates author set intersection and returns (overlap_count, common_authors).
        """
        set_a = cls.extract_author_set(authors_a)
        set_b = cls.extract_author_set(authors_b)
        
        # We only count meaningful author tokens (length >= 4 to avoid tiny matching noise)
        meaningful_a = {a for a in set_a if len(a) >= 4}
        meaningful_b = {b for b in set_b if len(b) >= 4}
        
        common = meaningful_a.intersection(meaningful_b)
        return len(common), common

    @classmethod
    def flag_corpus_duplicates(cls, papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Scans all papers in corpus and flags potential duplicates based on:
        1. Exact DOI match
        2. High Title Similarity (>= 0.88)
        3. Author Overlap Rule: >= 2 Common Authors AND (Title Sim >= 0.60 OR Year diff <= 1)
        """
        n = len(papers)
        # Create a deep copy list of dicts to attach flags
        flagged_papers = [dict(p) for p in papers]

        # Reset duplicate flags
        for p in flagged_papers:
            p["duplicate_flag"] = False
            p["duplicate_with_id"] = None
            p["duplicate_reason"] = None

        for i in range(n):
            for j in range(i + 1, n):
                p1 = flagged_papers[i]
                p2 = flagged_papers[j]

                doi1 = cls.normalize_doi(p1.get("doi", ""))
                doi2 = cls.normalize_doi(p2.get("doi", ""))
                t_sim = cls.title_similarity(p1.get("title", ""), p2.get("title", ""))
                
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
                overlap_count, common_authors = cls.check_author_overlap(p1.get("authors", ""), p2.get("authors", ""))
                year_diff = abs(int(p1.get("year", 2024)) - int(p2.get("year", 2024)))

                if overlap_count >= 2:
                    if t_sim >= 0.60 or year_diff <= 1:
                        reason = f"Author Overlap ({overlap_count} matches: {', '.join(list(common_authors)[:2])}) with {p2.get('id')}"
                        p1["duplicate_flag"] = True
                        p1["duplicate_with_id"] = p2.get("id")
                        p1["duplicate_reason"] = reason

                        p2["duplicate_flag"] = True
                        p2["duplicate_with_id"] = p1.get("id")
                        p2["duplicate_reason"] = f"Author Overlap ({overlap_count} matches: {', '.join(list(common_authors)[:2])}) with {p1.get('id')}"

        return flagged_papers

    @classmethod
    def merge_records(cls, existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two duplicate paper records preserving the richest metadata.
        """
        merged = dict(existing)
        
        # Prefer non-N/A abstract
        if (merged.get("abstract") == "N/A" or not merged.get("abstract")) and incoming.get("abstract") and incoming.get("abstract") != "N/A":
            merged["abstract"] = incoming["abstract"]
            
        # Prefer valid DOI
        if (merged.get("doi") == "N/A" or not merged.get("doi")) and incoming.get("doi") and incoming.get("doi") != "N/A":
            merged["doi"] = incoming["doi"]
            
        # Prefer valid URL
        if not merged.get("url") and incoming.get("url"):
            merged["url"] = incoming["url"]
            
        # Prefer highest citation count
        merged["citations_count"] = max(merged.get("citations_count", 0), incoming.get("citations_count", 0))
        
        # Combine sources if different
        src1 = merged.get("source", "")
        src2 = incoming.get("source", "")
        if src2 and src2 not in src1:
            merged["source"] = f"{src1}, {src2}".strip(", ")
            
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
        Returns: (unique_new_papers_to_add, duplicates_count)
        """
        retained = list(existing_papers)
        unique_new = []
        duplicates_count = 0

        for incoming in new_papers:
            incoming_doi = cls.normalize_doi(incoming.get("doi", ""))
            incoming_title = incoming.get("title", "")
            is_dup = False

            for i, target in enumerate(retained):
                target_doi = cls.normalize_doi(target.get("doi", ""))
                
                # Exact DOI Match
                if incoming_doi and target_doi and incoming_doi == target_doi:
                    is_dup = True
                    retained[i] = cls.merge_records(target, incoming)
                    duplicates_count += 1
                    break
                
                # Fuzzy Title Similarity
                sim = cls.title_similarity(incoming_title, target.get("title", ""))
                if sim >= similarity_threshold:
                    is_dup = True
                    retained[i] = cls.merge_records(target, incoming)
                    duplicates_count += 1
                    break

            if not is_dup:
                retained.append(incoming)
                unique_new.append(incoming)

        return unique_new, duplicates_count
