import urllib.request
import urllib.parse
import json
import re
import html
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Dict, Any, List

logger = logging.getLogger("rbl-abstract-resolver")

class AbstractResolver:
    USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

    @classmethod
    def clean_doi(cls, doi: Optional[str]) -> Optional[str]:
        if not doi or doi == "N/A":
            return None
        d = doi.strip()
        d = re.sub(r"^https?://(dx\.)?doi\.org/", "", d, flags=re.IGNORECASE)
        d = d.strip()
        return d if d else None

    @classmethod
    def resolve_single_paper_abstract(cls, paper: Dict[str, Any]) -> Dict[str, Any]:
        """
        Attempts to resolve abstract for a paper through 3 tiers:
        Tier 1: Cross-Academic APIs (OpenAlex, Semantic Scholar, CrossRef)
        Tier 2: Direct Publisher HTML Scraping (following DOI / URL redirects)
        Tier 3: Fuzzy Title Query via OpenAlex
        """
        doi = cls.clean_doi(paper.get("doi"))
        url = paper.get("url")
        title = paper.get("title")

        # If abstract is already valid (>= 40 chars and not N/A), keep it
        existing_abs = paper.get("abstract")
        if existing_abs and existing_abs != "N/A" and len(existing_abs.strip()) >= 40:
            return {
                "paper_id": paper.get("id"),
                "status": "already_present",
                "abstract": existing_abs,
                "source": paper.get("source", "Existing")
            }

        # -------------------------------------------------------------
        # TIER 1: CROSS-ACADEMIC APIS (IF DOI AVAILABLE)
        # -------------------------------------------------------------
        if doi:
            # 1A. OpenAlex API
            oa_abs = cls._fetch_openalex_abstract_by_doi(doi)
            if oa_abs:
                return {
                    "paper_id": paper.get("id"),
                    "status": "resolved",
                    "abstract": oa_abs,
                    "source": "OpenAlex API"
                }

            # 1B. Semantic Scholar API
            s2_abs = cls._fetch_semantic_scholar_abstract_by_doi(doi)
            if s2_abs:
                return {
                    "paper_id": paper.get("id"),
                    "status": "resolved",
                    "abstract": s2_abs,
                    "source": "Semantic Scholar API"
                }

            # 1C. CrossRef XML Abstract
            cr_abs = cls._fetch_crossref_abstract_by_doi(doi)
            if cr_abs:
                return {
                    "paper_id": paper.get("id"),
                    "status": "resolved",
                    "abstract": cr_abs,
                    "source": "CrossRef API"
                }

        # -------------------------------------------------------------
        # TIER 2: DIRECT DOI / URL LANDING PAGE HTML SCRAPER
        # -------------------------------------------------------------
        target_urls = []
        if doi:
            target_urls.append(f"https://doi.org/{doi}")
        if url and url != "N/A" and url.startswith("http"):
            if url not in target_urls:
                target_urls.append(url)

        for t_url in target_urls:
            html_abs = cls._scrape_html_abstract(t_url)
            if html_abs:
                return {
                    "paper_id": paper.get("id"),
                    "status": "resolved",
                    "abstract": html_abs,
                    "source": "Publisher Web Page"
                }

        # -------------------------------------------------------------
        # TIER 3: FUZZY TITLE SEARCH VIA OPENALEX
        # -------------------------------------------------------------
        if title and len(title.strip()) > 10:
            title_abs = cls._fetch_openalex_abstract_by_title(title)
            if title_abs:
                return {
                    "paper_id": paper.get("id"),
                    "status": "resolved",
                    "abstract": title_abs,
                    "source": "OpenAlex Title Search"
                }

        return {
            "paper_id": paper.get("id"),
            "status": "failed",
            "abstract": None,
            "source": None
        }

    # -----------------------------------------------------------------
    # HELPER RESOLVERS
    # -----------------------------------------------------------------

    @classmethod
    def _fetch_openalex_abstract_by_doi(cls, doi: str) -> Optional[str]:
        try:
            url = f"https://api.openalex.org/works/doi:{doi}"
            req = urllib.request.Request(url, headers={"User-Agent": cls.USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                inv = data.get("abstract_inverted_index")
                if inv and isinstance(inv, dict):
                    positions = {}
                    for word, idxs in inv.items():
                        for idx in idxs:
                            positions[idx] = word
                    reconstructed = " ".join(positions[i] for i in sorted(positions.keys()))
                    if len(reconstructed.strip()) >= 40:
                        return cls._clean_text(reconstructed)
        except Exception as e:
            logger.debug(f"OpenAlex DOI fetch failed for {doi}: {e}")
        return None

    @classmethod
    def _fetch_semantic_scholar_abstract_by_doi(cls, doi: str) -> Optional[str]:
        try:
            url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=abstract"
            req = urllib.request.Request(url, headers={"User-Agent": cls.USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                ab = data.get("abstract")
                if ab and len(ab.strip()) >= 40:
                    return cls._clean_text(ab)
        except Exception as e:
            logger.debug(f"Semantic Scholar DOI fetch failed for {doi}: {e}")
        return None

    @classmethod
    def _fetch_crossref_abstract_by_doi(cls, doi: str) -> Optional[str]:
        try:
            url = f"https://api.crossref.org/works/{doi}"
            req = urllib.request.Request(url, headers={"User-Agent": cls.USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                item = data.get("message", {})
                ab = item.get("abstract")
                if ab and len(ab.strip()) >= 40:
                    # Strip JATS XML tags
                    clean_ab = re.sub(r"<[^>]+>", " ", ab)
                    return cls._clean_text(clean_ab)
        except Exception as e:
            logger.debug(f"CrossRef DOI fetch failed for {doi}: {e}")
        return None

    @classmethod
    def _scrape_html_abstract(cls, url: str) -> Optional[str]:
        """
        Follows redirects and inspects scholarly <meta> tags & DOM classes.
        """
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": cls.USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9"
                }
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                content = resp.read().decode("utf-8", errors="ignore")

                # Strategy 1: Scholarly Meta Tags
                meta_patterns = [
                    r'<meta\s+[^>]*(?:name|property)=["\'](?:citation_abstract|dc\.description|dc\.Description|og:description|description|twitter:description)["\'][^>]*content=["\'](.*?)["\']',
                    r'<meta\s+[^>]*content=["\'](.*?)["\'][^>]*(?:name|property)=["\'](?:citation_abstract|dc\.description|dc\.Description|og:description|description|twitter:description)["\']'
                ]

                for pat in meta_patterns:
                    matches = re.findall(pat, content, re.IGNORECASE | re.DOTALL)
                    for m in matches:
                        clean = cls._clean_text(m)
                        # Filter out generic website descriptions
                        if len(clean) >= 60 and not clean.lower().startswith("read ") and not clean.lower().startswith("welcome to "):
                            return clean

                # Strategy 2: Common Scholarly DOM Selectors
                dom_patterns = [
                    r'<(?:section|div|p)\s+[^>]*(?:class|id)=["\'][^"\']*(?:abstract-content|article-abstract|abstractSection|article-details__abstract|abstract_text|abstract-body|abstract)[^"\']*["\'][^>]*>(.*?)</(?:section|div|p)>',
                    r'<div\s+[^>]*class=["\'][^"\']*abstract[^"\']*["\'][^>]*>(.*?)</div>',
                    r'<section\s+[^>]*class=["\'][^"\']*abstract[^"\']*["\'][^>]*>(.*?)</section>'
                ]

                for pat in dom_patterns:
                    dom_match = re.search(pat, content, re.IGNORECASE | re.DOTALL)
                    if dom_match:
                        raw_block = dom_match.group(1)
                        # Strip nested tags
                        clean_block = re.sub(r"<[^>]+>", " ", raw_block)
                        # Remove leading "Abstract" heading word if present
                        clean_block = re.sub(r"^(?:Abstract|ABSTRACT|Summary)[\s:\-\.]*", "", clean_block.strip())
                        cleaned = cls._clean_text(clean_block)
                        if len(cleaned) >= 60:
                            return cleaned

        except Exception as e:
            logger.debug(f"Publisher HTML scraping failed for {url}: {e}")
        return None

    @classmethod
    def _fetch_openalex_abstract_by_title(cls, title: str) -> Optional[str]:
        try:
            clean_title = re.sub(r"[^a-zA-Z0-9\s]", " ", title).strip()
            encoded_title = urllib.parse.quote(clean_title)
            url = f"https://api.openalex.org/works?filter=title.search:{encoded_title}&per-page=1"
            req = urllib.request.Request(url, headers={"User-Agent": cls.USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = data.get("results", [])
                if results:
                    top = results[0]
                    inv = top.get("abstract_inverted_index")
                    if inv and isinstance(inv, dict):
                        positions = {}
                        for word, idxs in inv.items():
                            for idx in idxs:
                                positions[idx] = word
                        reconstructed = " ".join(positions[i] for i in sorted(positions.keys()))
                        if len(reconstructed.strip()) >= 40:
                            return cls._clean_text(reconstructed)
        except Exception as e:
            logger.debug(f"OpenAlex title fetch failed for {title}: {e}")
        return None

    @classmethod
    def _clean_text(cls, text: str) -> str:
        if not text:
            return ""
        # Unescape HTML entities (e.g. &amp;, &quot;, &#x2019;)
        t = html.unescape(text)
        # Remove XML / HTML tags
        t = re.sub(r"<[^>]+>", " ", t)
        # Normalize whitespace and line breaks
        t = re.sub(r"\s+", " ", t)
        return t.strip()

    @classmethod
    def bulk_resolve_abstracts(cls, papers: List[Dict[str, Any]], max_workers: int = 5) -> List[Dict[str, Any]]:
        """
        Concurrently resolves abstracts for multiple papers in parallel.
        """
        results = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_paper = {executor.submit(cls.resolve_single_paper_abstract, p): p for p in papers}
            for future in as_completed(future_to_paper):
                try:
                    res = future.result()
                    results.append(res)
                except Exception as e:
                    p = future_to_paper[future]
                    results.append({
                        "paper_id": p.get("id"),
                        "status": "error",
                        "abstract": None,
                        "error": str(e)
                    })
        return results
